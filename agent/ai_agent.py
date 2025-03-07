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
import json
from typing import Dict, Optional

api_key = os.getenv("OPENAI_API_KEY")

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
        self.current_participant: Optional[Participant] = None
        self.human_participants: Dict[str, Dict[str, str]] = {}  # {participant_id: {"language": code, "name": name}}
        self.audio_listener_tasks: Dict[str, asyncio.Task] = {}
        self.agent = VideoSDK.init_meeting(**self.meeting_config)
        self.agent.add_event_listener(
            MeetingHandler(
                on_meeting_joined=self.on_meeting_joined,
                on_meeting_left=self.on_meeting_left,
                on_participant_joined=self.on_participant_joined,
                on_participant_left=self.on_participant_left,
            ))
        
        # Translation-specific tools
        self.translation_tools = [
            {
                "name": "translate_and_speak",
                "type": "function",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "original_text": {
                            "type": "string",
                            "description": "The original transcribed text"
                        },
                        "source_language": {
                            "type": "string",
                            "description": "The language code of the speaker"
                        },
                        "target_language": {
                            "type": "string",
                            "description": "The language code to translate to"
                        },
                        "translated_text": {
                            "type": "string",
                            "description": "The translated text"
                        }
                    },
                    "required": ["original_text", "source_language", "target_language", "translated_text"]
                },
                "description": "Translate the speaker's message and prepare it for speech output"
            }
        ]
        
        # Initialize OpenAI connection parameters
        self.intelligence = OpenAIIntelligence(
            loop=self.loop,
            api_key=api_key,
            base_url="api.openai.com",
            input_audio_transcription=InputAudioTranscription(model="whisper-1"),
            audio_track=self.audio_track,
            tools=self.translation_tools,
            instructions="""
            You are a real-time translator in a video meeting. Your role is to:
            1. Listen to participants speaking in their native languages
            2. Translate their speech to the target language of other participants
            3. Speak the translation naturally and clearly
            4. Maintain the speaker's tone and intent in the translation
            5. Handle translation between any language pair provided
            
            When translating:
            - For English (en) to Hindi (hi): Maintain formal tone and cultural context
            - For Hindi (hi) to English (en): Preserve meaning while making it natural in English
            - Always announce the speaker's name before translation
            - Keep translations concise but accurate
            
            Always use the translate_and_speak function to process translations.
            Keep the conversation flowing naturally without unnecessary interruptions.
            """,
            handle_function_call=self.handle_translation
        )
        self._is_running = True
        self.current_speaker_id = None

    def handle_translation(self, function_call):
        """Handle the translation function call from OpenAI"""
        try:
            # Parse the function call arguments properly
            if isinstance(function_call, dict) and 'function_call' in function_call:
                args = json.loads(function_call['function_call'].get('arguments', '{}'))
            elif isinstance(function_call, dict) and 'arguments' in function_call:
                args = json.loads(function_call['arguments'])
            else:
                print("Invalid function call format")
                return

            # Get the current speaker's information
            speaker_info = self.human_participants.get(self.current_speaker_id, {})
            speaker_name = speaker_info.get('name', 'Unknown Speaker')

            # Log the translation
            print(f"\nTranslation for {speaker_name}:")
            print(f"Original ({args['source_language']}): {args['original_text']}")
            print(f"Translated ({args['target_language']}): {args['translated_text']}\n")
            
            # The translated speech will be automatically handled by OpenAI's text-to-speech
            # through the audio_track
            
        except json.JSONDecodeError as e:
            print(f"Error parsing translation arguments: {e}")
        except Exception as e:
            print(f"Error handling translation: {e}")
    
    async def add_audio_listener(self, stream: Stream, participant_id: str):
        retry_count = 0
        max_retries = 3
        
        while self._is_running:
            try:
                await asyncio.sleep(0.01)
                if not self.intelligence.ws or self.intelligence.ws.closed:
                    continue

                frame = await stream.track.recv()
                audio_data = frame.to_ndarray()[0]
                
                # Convert to float32 and normalize
                audio_data_float = (audio_data.astype(np.float32) / 
                                  np.iinfo(np.int16).max)
                
                # Convert to mono and resample to 16kHz for OpenAI
                audio_mono = librosa.to_mono(audio_data_float.T)
                audio_resampled = librosa.resample(
                    audio_mono, 
                    orig_sr=48000, 
                    target_sr=16000
                )
                
                # Convert to PCM16 bytes
                pcm_frame = (audio_resampled * np.iinfo(np.int16).max
                           ).astype(np.int16).tobytes()
                
                # Update current speaker
                self.current_speaker_id = participant_id
                
                # Send to OpenAI if we have a valid connection
                if not self.intelligence.ws.closed:
                    await self.intelligence.send_audio_data(pcm_frame)
                    retry_count = 0  # Reset retry count on successful send

            except asyncio.CancelledError:
                print("Audio listener task cancelled")
                break
            except Exception as e:
                retry_count += 1
                print(f"Audio processing error (attempt {retry_count}/{max_retries}): {str(e)}")
                
                if retry_count >= max_retries:
                    print(f"Max retries reached for audio processing, resetting connection...")
                    await self.intelligence.connect()  # Attempt to reconnect
                    retry_count = 0
                
                await asyncio.sleep(1)  # Wait before retrying
                continue
                
    def on_meeting_joined(self, data):
        print("Meeting Joined - Starting OpenAI connection")
        asyncio.create_task(self.intelligence.connect())
    
    def on_meeting_left(self, data):
        print(f"Meeting Left")
        self._is_running = False
        # Cancel all audio listener tasks
        for task in self.audio_listener_tasks.values():
            if not task.done():
                task.cancel()
        
    def on_participant_joined(self, participant: Participant):
        if participant.id != self.agent.id:  # Skip the AI agent itself
            # metadata is already a dict, no need to parse it
            metadata = participant.meta_data
            language = metadata.get("preferredLanguage", "en")  # Default to English if not specified
            
            self.human_participants[participant.id] = {
                "language": language,
                "name": participant.display_name
            }
            print(f"Participant joined: {participant.display_name} (Language: {language})")
            
        def on_stream_enabled(stream: Stream):
            print(f"Stream enabled for {participant.display_name}")
            self.current_participant = participant
            if stream.kind == "audio":
                # Cancel existing task if any
                existing_task = self.audio_listener_tasks.get(stream.id)
                if existing_task and not existing_task.done():
                    existing_task.cancel()
                
                # Create new audio listener task with participant ID
                self.audio_listener_tasks[stream.id] = self.loop.create_task(
                    self.add_audio_listener(stream, participant.id)
                )

        def on_stream_disabled(stream: Stream):
            print(f"Stream disabled for {participant.display_name}")
            if stream.kind == "audio":
                audio_task = self.audio_listener_tasks.get(stream.id)
                if audio_task and not audio_task.done():
                    audio_task.cancel()
                self.audio_listener_tasks.pop(stream.id, None)
            
        participant.add_event_listener(
            ParticipantHandler(
                participant_id=participant.id,
                on_stream_enabled=on_stream_enabled,
                on_stream_disabled=on_stream_disabled
            )
        )

    def on_participant_left(self, participant: Participant):
        if participant.id in self.human_participants:
            print(f"Participant left: {participant.display_name}")
            del self.human_participants[participant.id]
          
    async def join(self):
        self._is_running = True
        await self.agent.async_join()
    
    def leave(self):
        self._is_running = False
        for task in self.audio_listener_tasks.values():
            if not task.done():
                task.cancel()
        self.agent.leave()