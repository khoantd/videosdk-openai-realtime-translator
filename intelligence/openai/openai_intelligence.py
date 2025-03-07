import base64
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

from asyncio.log import logger
from asyncio import AbstractEventLoop
import aiohttp
import asyncio
from agent.audio_stream_track import CustomAudioStreamTrack

class OpenAIIntelligence:
    def __init__(
        self, 
        loop: AbstractEventLoop, 
        api_key: str,
        model: str = "gpt-4o-realtime-preview-2024-10-01",
        instructions: str = "",
        base_url: str = "api.openai.com",
        voice: Voices = Voices.Alloy,
        temperature: float = 0.7,
        tools: List[Dict[str, Union[str, any]]] = [],
        input_audio_transcription: InputAudioTranscription = InputAudioTranscription(
            model="whisper-1"
        ),
        clear_audio_queue: Callable[[], None] = lambda: None,
        handle_function_call: Callable[[ResponseFunctionCallArgumentsDone], None] = lambda x: None,
        modalities: List[str] = ["text", "audio"],
        max_response_output_tokens: int = 512,
        turn_detection: ServerVADUpdateParams = ServerVADUpdateParams(
            type="server_vad",
            threshold=0.5,
            prefix_padding_ms=300,
            silence_duration_ms=200,
        ),
        audio_track: Optional[CustomAudioStreamTrack] = None,
    ):
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
        self.ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self.audio_track = audio_track
        self.receive_message_task: Optional[asyncio.Task] = None
        self._is_connected = False
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 5
        self._reconnect_delay = 1  # Initial delay in seconds
        
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

    async def connect(self):
        if self._is_connected and self.ws and not self.ws.closed:
            return

        try:
            if self._reconnect_attempts >= self._max_reconnect_attempts:
                logger.error("Max reconnection attempts reached")
                return

            url = f"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
            logger.info(f"Establishing OpenAI WS connection (attempt {self._reconnect_attempts + 1})...")
            
            self.ws = await self._http_session.ws_connect(
                url=url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "OpenAI-Beta": "realtime=v1",
                },
                heartbeat=30.0,
                max_msg_size=0  # No limit on message size
            )
            
            logger.info("OpenAI WS connection established")
            self._is_connected = True
            self._reconnect_attempts = 0  # Reset counter on successful connection
            self._reconnect_delay = 1  # Reset delay
            
            # Start message handler
            if self.receive_message_task:
                self.receive_message_task.cancel()
            self.receive_message_task = self.loop.create_task(
                self.receive_message_handler()
            )

            await self.update_session(self.session_update_params)

        except Exception as e:
            logger.error(f"Failed to connect to OpenAI: {e}")
            self._is_connected = False
            if self.ws:
                await self.ws.close()
            self.ws = None
            
            self._reconnect_attempts += 1
            await asyncio.sleep(self._reconnect_delay)
            self._reconnect_delay = min(self._reconnect_delay * 2, 30)  # Exponential backoff, max 30 seconds
            
            if self._reconnect_attempts < self._max_reconnect_attempts:
                logger.info(f"Attempting to reconnect in {self._reconnect_delay} seconds...")
                await self.connect()
            raise

    async def update_session(self, session: SessionUpdateParams):
        if not self.ws or self.ws.closed:
            await self.connect()
        try:
            await self.send_request(
                SessionUpdate(
                    event_id=generate_event_id(),
                    session=session,
                )
            )
        except Exception as e:
            logger.error(f"Failed to update session: {e}")
            self._is_connected = False
            await self.connect()
    
    async def send_request(self, request: ClientToServerMessage):
        if not self.ws or self.ws.closed:
            await self.connect()
        try:
            request_json = to_json(request)
            await self.ws.send_str(request_json)
        except Exception as e:
            logger.error(f"Error sending request: {e}")
            self._is_connected = False
            await self.connect()
            
    async def send_audio_data(self, audio_data: bytes):
        """Send PCM16 16kHz mono audio data to OpenAI"""
        if not self.ws or self.ws.closed:
            await self.connect()
        try:
            base64_audio_data = base64.b64encode(audio_data).decode("utf-8")
            message = InputAudioBufferAppend(audio=base64_audio_data)
            await self.send_request(message)
        except Exception as e:
            logger.error(f"Error sending audio data: {e}")
            self._is_connected = False
            await self.connect()

    async def receive_message_handler(self):
        while True:
            try:
                if not self.ws:
                    await asyncio.sleep(1)
                    continue

                async for response in self.ws:
                    if response.type == aiohttp.WSMsgType.TEXT:
                        await self.handle_response(response.data)
                    elif response.type == aiohttp.WSMsgType.ERROR:
                        logger.error(f"WebSocket error: {response}")
                        self._is_connected = False
                        await self.connect()
                        break
                    elif response.type == aiohttp.WSMsgType.CLOSED:
                        logger.info("WebSocket connection closed")
                        self._is_connected = False
                        await self.connect()
                        break
                    
                    await asyncio.sleep(0.01)

            except asyncio.CancelledError:
                logger.info("Message handler cancelled")
                break
            except Exception as e:
                logger.error(f"Error in message handler: {e}")
                self._is_connected = False
                await asyncio.sleep(1)
                await self.connect()

    async def close(self):
        """Properly close the WebSocket connection"""
        self._is_connected = False
        if self.receive_message_task:
            self.receive_message_task.cancel()
            try:
                await self.receive_message_task
            except asyncio.CancelledError:
                pass
        
        if self.ws:
            await self.ws.close()
        
        if self._http_session:
            await self._http_session.close()
                
    def on_audio_response(self, audio_bytes: bytes):
        """Handle translated audio response from OpenAI"""
        if self.audio_track:
            self.loop.create_task(
                self.audio_track.add_new_bytes(iter([audio_bytes]))
            )
        
    async def handle_response(self, message: str):
        try:
            message_data = json.loads(message)

            match message_data["type"]:
                case EventType.SESSION_CREATED:
                    logger.info("Session created successfully")
                    
                case EventType.SESSION_UPDATE:
                    logger.info("Session updated successfully")

                case EventType.RESPONSE_AUDIO_DELTA:
                    self.on_audio_response(base64.b64decode(message_data["delta"]))
                    
                case EventType.RESPONSE_AUDIO_TRANSCRIPT_DONE:
                    logger.info(f"Response Transcription: {message_data.get('transcript', '')}")
                
                case EventType.ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
                    logger.info(f"Client Transcription: {message_data.get('transcript', '')}")
                
                case EventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
                    logger.info("Speech started, clearing audio queue")
                    self.clear_audio_queue()
                    
                case EventType.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
                    if self.handle_function_call:
                        await self.loop.run_in_executor(
                            None, 
                            self.handle_function_call, 
                            message_data
                        )
            
                case EventType.ERROR:
                    error_msg = message_data.get('error', {})
                    if isinstance(error_msg, dict):
                        error_str = json.dumps(error_msg)
                    else:
                        error_str = str(error_msg)
                    logger.error(f"Server Error: {error_str}")
                    
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message: {e}")
        except Exception as e:
            logger.error(f"Error handling response: {e}")