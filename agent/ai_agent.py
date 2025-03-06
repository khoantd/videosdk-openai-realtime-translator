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

api_key=os.getenv("OPENAI_API_KEY")

class AIAgent:
    def __init__(self, meeting_id: str, authToken: str, name: str):
        self.loop = asyncio.get_event_loop()
        self.audio_track = CustomAudioStreamTrack(
            loop=self.loop,
            handle_interruption=True
        )
        self.meeting_config = MeetingConfig(
            name=name,
            meeting_id=meeting_id,
            token=authToken,
            mic_enabled=True,
            webcam_enabled=False,
            custom_microphone_audio_track=self.audio_track
        )
        self.current_participant = None
        self.audio_listener_tasks = {}
        self.agent = VideoSDK.init_meeting(**self.meeting_config)
        self.agent.add_event_listener(
            MeetingHandler(
                on_meeting_joined=self.on_meeting_joined,
                on_meeting_left=self.on_meeting_left,
                on_participant_joined=self.on_participant_joined,
                on_participant_left=self.on_participant_left,
            ))
        
            # Initialize OpenAI connection parameters
        self.intelligence = OpenAIIntelligence(
            loop=self.loop,
            api_key=api_key,
            base_url="api.openai.com",  # Verify correct API endpoint
            input_audio_transcription=InputAudioTranscription(model="whisper-1"),
            audio_track=self.audio_track
        )

    
    async def add_audio_listener(self, stream: Stream):
        while True:
            try:
                await asyncio.sleep(0.01)
                if not self.intelligence.ws:
                    continue

                frame = await stream.track.recv()
                # audio_data = frame.to_ndarray()[0]
                
                # # Convert to float32 and normalize
                # audio_data_float = (audio_data.astype(np.float32) / 
                #                   np.iinfo(np.int16).max)
                
                # # Convert to mono and resample to 24kHz
                # audio_mono = librosa.to_mono(audio_data_float.T)
                # audio_resampled = librosa.resample(
                #     audio_mono, 
                #     orig_sr=48000, 
                #     target_sr=24000  # Changed to OpenAI's required 24kHz
                # )

                # sf.write('debug_audio.wav', audio_resampled, 24000, subtype='PCM_16')
                
                # # Convert to PCM16 bytes
                # pcm_frame = (audio_resampled * np.iinfo(np.int16).max
                #            ).astype(np.int16).tobytes()
                
                
                
                
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
                
                
                # Send to OpenAI
                await self.intelligence.send_audio_data(pcm_frame)

            except Exception as e:
                print("Audio processing error:", e)
                break
                
        
    def on_meeting_joined(self, data):
        print("Meeting Joined - Starting OpenAI connection")
        asyncio.create_task(self.intelligence.connect())
    
    def on_meeting_left(self, data):
        print(f"Meeting Left")
        
    def on_participant_joined(self, participant: Participant):
        print("Participant joined:", participant.display_name)
        
        def on_stream_enabled(stream: Stream):
            print("Participant stream enabled")
            self.current_participant = participant
            if stream.kind == "audio":
                self.audio_listener_tasks[stream.id] = self.loop.create_task(
                    self.add_audio_listener(stream)
                )

        def on_stream_disabled(stream: Stream):
            print("Participant stream disabled")
            if stream.kind == "audio":
                audio_task = self.audio_listener_tasks[stream.id]
                if audio_task is not None:
                    audio_task.cancel()

            
        participant.add_event_listener(
            ParticipantHandler(
                participant_id=participant.id,
                on_stream_enabled=on_stream_enabled,
                on_stream_disabled=on_stream_disabled
            )
        )

    def on_participant_left(self, participant: Participant):
        print("Participant left:", participant.display_name)
          
    async def join(self):
        await self.agent.async_join()
    
    def leave(self):
        self.agent.leave()