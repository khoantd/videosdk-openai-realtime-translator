from videosdk import MeetingConfig, VideoSDK, Participant, Stream
from rtc.videosdk.meeting_handler import MeetingHandler
from rtc.videosdk.participant_handler import ParticipantHandler
from agent.audio_stream_track import CustomAudioStreamTrack
from intelligence.openai.openai_intelligence import OpenAIIntelligence
from utils.struct.openai import InputAudioTranscription

import soundfile as sf
import numpy as np
import librosa
import asyncio
import os
import logging
import time
from datetime import datetime

# Configure logging for AI Agent
logger = logging.getLogger(__name__)

api_key = os.getenv("OPENAI_API_KEY")


class AIAgent:
    def __init__(self, meeting_id: str, authToken: str, name: str):
        logger.info(f"Initializing AI Agent: {name} for meeting: {meeting_id}")
        
        self.loop = asyncio.get_event_loop()
        self.audio_track = CustomAudioStreamTrack(
            loop=self.loop, handle_interruption=True
        )
        self.meeting_config = MeetingConfig(
            name=name,
            meeting_id=meeting_id,
            token=authToken,
            mic_enabled=True,
            webcam_enabled=False,
            custom_microphone_audio_track=self.audio_track,
        )
        self.current_participant = None
        self.audio_listener_tasks = {}
        self.agent = VideoSDK.init_meeting(**self.meeting_config)
        
        logger.info("Setting up event listeners for meeting")
        self.agent.add_event_listener(
            MeetingHandler(
                on_meeting_joined=self.on_meeting_joined,
                on_meeting_left=self.on_meeting_left,
                on_participant_joined=self.on_participant_joined,
                on_participant_left=self.on_participant_left,
            )
        )

        # Initialize OpenAI connection parameters
        logger.info("Initializing OpenAI Intelligence module")
        self.intelligence = OpenAIIntelligence(
            loop=self.loop,
            api_key=api_key,
            base_url="api.openai.com",  # Verify correct API endpoint
            input_audio_transcription=InputAudioTranscription(model="whisper-1"),
            audio_track=self.audio_track,
        )

        self.participants_data = {}
        logger.info("AI Agent initialization completed")

    async def add_audio_listener(self, stream: Stream):
        participant_name = "Unknown"
        if self.current_participant:
            participant_name = self.current_participant.display_name
            
        logger.info(f"Starting audio listener for participant: {participant_name}")
        frame_count = 0
        start_time = time.time()
        
        while True:
            try:
                await asyncio.sleep(0.01)
                if not self.intelligence.ws:
                    logger.warning("OpenAI WebSocket not connected, skipping audio processing")
                    continue

                frame = await stream.track.recv()
                frame_count += 1
                
                audio_data = frame.to_ndarray()[0]
                audio_data_float = (
                    audio_data.astype(np.float32) / np.iinfo(np.int16).max
                )
                audio_mono = librosa.to_mono(audio_data_float.T)
                audio_resampled = librosa.resample(
                    audio_mono, orig_sr=48000, target_sr=16000
                )
                pcm_frame = (
                    (audio_resampled * np.iinfo(np.int16).max)
                    .astype(np.int16)
                    .tobytes()
                )

                # Log audio processing stats every 100 frames
                if frame_count % 100 == 0:
                    elapsed_time = time.time() - start_time
                    fps = frame_count / elapsed_time if elapsed_time > 0 else 0
                    logger.info(f"Audio processing stats - Participant: {participant_name}, Frames: {frame_count}, FPS: {fps:.2f}")

                # Send to OpenAI
                await self.intelligence.send_audio_data(pcm_frame)

            except Exception as e:
                logger.error(f"Audio processing error for {participant_name}: {e}")
                logger.error(f"Exception type: {type(e).__name__}")
                break

    def on_meeting_joined(self, data):
        logger.info(f"Meeting Joined - Data: {data}")
        logger.info("Starting OpenAI connection")
        asyncio.create_task(self.intelligence.connect())

    def on_meeting_left(self, data):
        logger.info(f"Meeting Left - Data: {data}")

    def on_participant_joined(self, participant: Participant):
        peer_name = participant.display_name
        native_lang = participant.meta_data.get("preferredLanguage", "Unknown")
        
        logger.info(f"Participant joined: {peer_name}")
        logger.info(f"Native language: {native_lang}")
        logger.info(f"Participant ID: {participant.id}")
        logger.info(f"Participant metadata: {participant.meta_data}")
        
        self.participants_data[participant.id] = {
            "name": peer_name,
            "lang": native_lang,
        }
        
        logger.info(f"Current participants data: {self.participants_data}")

        if len(self.participants_data) == 2:
            # Extract the info for each participant
            participant_ids = list(self.participants_data.keys())
            p1 = self.participants_data[participant_ids[0]]
            p2 = self.participants_data[participant_ids[1]]

            logger.info(f"Two participants detected - Setting up translation between:")
            logger.info(f"  Participant 1: {p1['name']} ({p1['lang']})")
            logger.info(f"  Participant 2: {p2['name']} ({p2['lang']})")

            # Build translator-specific instructions
            # Explanation:
            #  - The model should detect which participant is speaking by the incoming audio.
            #  - Then it should respond ONLY in the other participant's language with a translation, no extra commentary.
            translator_instructions = f"""
                You are a real-time translator bridging a conversation between:
                - {p1['name']} (speaks {p1['lang']})
                - {p2['name']} (speaks {p2['lang']})

                You have to listen and speak those exactly word in different language
                eg. when {p1['lang']} is spoken then say that exact in language {p2['lang']}
                similar when {p2['lang']} is spoken then say that exact in language {p1['lang']}
                Keep in account who speaks what and use 
                NOTE - 
                Your job is to translate, from one language to another, don't engage in any conversation
            """

            logger.info("Updating OpenAI session with translation instructions")
            logger.info(f"Translation instructions: {translator_instructions}")

            # Dynamically tell OpenAI to use these instructions
            asyncio.create_task(
                self.intelligence.update_session_instructions(translator_instructions)
            )

        def on_stream_enabled(stream: Stream):
            logger.info(f"Participant stream enabled - Type: {stream.kind}")
            logger.info(f"Stream ID: {stream.id}")
            self.current_participant = participant
            logger.info(f"Participant stream enabled for: {self.current_participant.display_name}")
            
            if stream.kind == "audio":
                logger.info(f"Creating audio listener task for stream: {stream.id}")
                self.audio_listener_tasks[stream.id] = self.loop.create_task(
                    self.add_audio_listener(stream)
                )

        def on_stream_disabled(stream: Stream):
            logger.info(f"Participant stream disabled - Type: {stream.kind}")
            logger.info(f"Stream ID: {stream.id}")
            
            if stream.kind == "audio":
                audio_task = self.audio_listener_tasks.get(stream.id)
                if audio_task is not None:
                    logger.info(f"Cancelling audio listener task for stream: {stream.id}")
                    audio_task.cancel()
                else:
                    logger.warning(f"No audio listener task found for stream: {stream.id}")

        participant.add_event_listener(
            ParticipantHandler(
                participant_id=participant.id,
                on_stream_enabled=on_stream_enabled,
                on_stream_disabled=on_stream_disabled,
            )
        )

    def on_participant_left(self, participant: Participant):
        logger.info(f"Participant left: {participant.display_name}")
        logger.info(f"Participant ID: {participant.id}")
        
        # Clean up participant data
        if participant.id in self.participants_data:
            removed_participant = self.participants_data.pop(participant.id)
            logger.info(f"Removed participant data: {removed_participant}")
        
        logger.info(f"Remaining participants: {self.participants_data}")

    async def join(self):
        logger.info("Attempting to join meeting...")
        await self.agent.async_join()
        logger.info("Successfully joined meeting")

    def leave(self):
        logger.info("Leaving meeting")
        self.agent.leave()
        logger.info("Meeting left successfully")
