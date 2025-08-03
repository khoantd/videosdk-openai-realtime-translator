import base64
import traceback
from typing import Dict, List, Union, Callable, Optional
from utils.struct.openai import (
    AudioFormats,
    ClientToServerMessage,
    EventType,
    InputAudioBufferAppend,
    InputAudioTranscription,
    ResponseFunctionCallArgumentsDone,
    ServerVADUpdateParams,
    SessionUpdate,
    SessionUpdateParams,
    Voices,
    generate_event_id,
    to_json,
)
import json
import logging
import time
from datetime import datetime

from asyncio.log import logger
from asyncio import AbstractEventLoop
import aiohttp
import asyncio
from agent.audio_stream_track import CustomAudioStreamTrack

# Configure logging for OpenAI Intelligence
logger = logging.getLogger(__name__)


class OpenAIIntelligence:
    def __init__(
        self,
        loop: AbstractEventLoop,
        api_key,
        model: str = "gpt-4o-realtime-preview-2024-10-01",
        instructions="""\
            Actively listen to the user's questions and provide concise, relevant responses. 
            Acknowledge the user's intent before answering. Keep responses under 2 sentences.\
        """,
        base_url: str = "api.openai.com",
        voice: Voices = Voices.Alloy,
        temperature: float = 0.8,
        tools: List[Dict[str, Union[str, any]]] = [],
        input_audio_transcription: InputAudioTranscription = InputAudioTranscription(
            model="whisper-1"
        ),
        clear_audio_queue: Callable[[], None] = lambda: None,
        handle_function_call: Callable[
            [ResponseFunctionCallArgumentsDone], None
        ] = lambda x: None,
        modalities=["text", "audio"],
        max_response_output_tokens=512,
        turn_detection: ServerVADUpdateParams = ServerVADUpdateParams(
            type="server_vad",
            threshold=0.5,
            prefix_padding_ms=300,
            silence_duration_ms=200,
        ),
        audio_track: CustomAudioStreamTrack = None,
    ):
        logger.info(f"Initializing OpenAI Intelligence with model: {model}")
        logger.info(f"Base URL: {base_url}")
        logger.info(f"Voice: {voice}")
        logger.info(f"Temperature: {temperature}")
        logger.info(f"Modalities: {modalities}")
        
        self.model = model
        self.loop = loop
        self.api_key = api_key
        self.instructions = instructions
        self.base_url = base_url
        self.temperature = temperature
        self.voice = voice
        self.tools = tools
        self.modalities = modalities
        self.max_response_output_tokens = max_response_output_tokens
        self.input_audio_transcription = input_audio_transcription
        self.clear_audio_queue = clear_audio_queue
        self.handle_function_call = handle_function_call
        self.turn_detection = turn_detection
        self.ws = None
        self.audio_track = audio_track

        self._http_session = aiohttp.ClientSession(loop=self.loop)
        self.session_update_params = SessionUpdateParams(
            model=self.model,
            instructions=self.instructions,
            input_audio_format=AudioFormats.PCM16,
            output_audio_format=AudioFormats.PCM16,
            temperature=self.temperature,
            voice=self.voice,
            tool_choice="auto",
            tools=self.tools,
            turn_detection=self.turn_detection,
            modalities=self.modalities,
            max_response_output_tokens=self.max_response_output_tokens,
            input_audio_transcription=self.input_audio_transcription,
        )
        # self.connected_event = asyncio.Event()   # used to notify when ws is ready
        self.pending_instructions: Optional[str] = None
        
        # Add counters for monitoring
        self.audio_frames_sent = 0
        self.messages_received = 0
        self.start_time = time.time()
        
        logger.info("OpenAI Intelligence initialization completed")

    async def connect(self):
        # url = f"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"
        url = f"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
        logger.info(f"Establishing OpenAI WS connection to: {url}")
        
        try:
            self.ws = await self._http_session.ws_connect(
                url=url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "OpenAI-Beta": "realtime=v1",
                },
            )
            logger.info("OpenAI WebSocket connection established successfully")

            if self.pending_instructions is not None:
                logger.info("Applying pending instructions")
                await self.update_session_instructions(self.pending_instructions)

            # self.connected_event = asyncio.Event()   # used to notify when ws is ready
            logger.info("Starting message handler task")
            self.receive_message_task = self.loop.create_task(
                self.receive_message_handler()
            )

            logger.info(f"List of tools: {self.tools}")

            logger.info("Updating session with initial parameters")
            await self.update_session(self.session_update_params)

            await self.receive_message_task
            
        except Exception as e:
            logger.error(f"Failed to establish WebSocket connection: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            raise

    async def update_session_instructions(self, new_instructions: str):
        """
        Dynamically update the system instructions (the system prompt)
        for translation into the target language.
        """
        logger.info("Updating session instructions")
        logger.info(f"New instructions: {new_instructions}")
        
        if self.ws is None:
            logger.warning("WebSocket not connected, storing instructions as pending")
            self.pending_instructions = new_instructions
            return

        self.session_update_params.instructions = new_instructions
        await self.update_session(self.session_update_params)

    async def update_session(self, session: SessionUpdateParams):
        logger.info(f"Updating session with tools: {session.tools}")
        await self.send_request(
            SessionUpdate(
                event_id=generate_event_id(),
                session=session,
            )
        )

    async def send_request(self, request: ClientToServerMessage):
        request_json = to_json(request)
        logger.debug(f"Sending request: {request.type}")
        await self.ws.send_str(request_json)

    async def send_audio_data(self, audio_data: bytes):
        """audio_data is assumed to be pcm16 24kHz mono little-endian"""
        self.audio_frames_sent += 1
        
        # Log audio stats every 100 frames
        if self.audio_frames_sent % 100 == 0:
            elapsed_time = time.time() - self.start_time
            fps = self.audio_frames_sent / elapsed_time if elapsed_time > 0 else 0
            logger.info(f"Audio stats - Frames sent: {self.audio_frames_sent}, FPS: {fps:.2f}")
        
        base64_audio_data = base64.b64encode(audio_data).decode("utf-8")
        message = InputAudioBufferAppend(audio=base64_audio_data)
        await self.send_request(message)

    async def receive_message_handler(self):
        logger.info("Starting message handler")
        while True:
            async for response in self.ws:
                try:
                    await asyncio.sleep(0.01)
                    if response.type == aiohttp.WSMsgType.TEXT:
                        self.messages_received += 1
                        logger.debug(f"Received message #{self.messages_received}")
                        self.handle_response(response.data)
                    elif response.type == aiohttp.WSMsgType.ERROR:
                        logger.error("Error while receiving data from openai", response)
                except Exception as e:
                    logger.error(f"Error in receiving message: {e}")
                    logger.error(f"Exception details: {traceback.format_exc()}")
                    traceback.print_exc()

    def clear_audio_queue(self):
        logger.debug("Clearing audio queue")
        pass

    def on_audio_response(self, audio_bytes: bytes):
        logger.debug(f"Received audio response: {len(audio_bytes)} bytes")
        self.loop.create_task(self.audio_track.add_new_bytes(iter([audio_bytes])))

    def handle_response(self, message: str):
        message_data = json.loads(message)
        message_type = message_data.get("type", "unknown")
        
        logger.debug(f"Handling response type: {message_type}")

        match message_type:

            case EventType.SESSION_CREATED:
                logger.info(f"Session Created: {message_data.get('session', {}).get('id', 'unknown')}")

            case EventType.SESSION_UPDATE:
                logger.info(f"Session Updated: {message_data.get('session', {}).get('id', 'unknown')}")

            case EventType.RESPONSE_AUDIO_DELTA:
                logger.debug(f"Audio delta received: {len(message_data.get('delta', ''))} chars")
                self.on_audio_response(base64.b64decode(message_data["delta"]))

            case EventType.RESPONSE_AUDIO_TRANSCRIPT_DONE:
                transcript = message_data.get('transcript', '')
                logger.info(f"Response Transcription: {transcript}")

            case EventType.ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
                transcript = message_data.get('transcript', '')
                logger.info(f"Client Transcription: {transcript}")

            case EventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
                logger.info("Speech started - Clearing audio queue")
                self.clear_audio_queue()

            case EventType.ERROR:
                error_data = message_data.get('error', {})
                logger.error(f"OpenAI Error: {error_data.get('message', 'Unknown error')}")
                logger.error(f"Error code: {error_data.get('code', 'No code')}")

            case _:
                logger.debug(f"Unhandled message type: {message_type}")
