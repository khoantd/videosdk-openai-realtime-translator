import asyncio
from fractions import Fraction
import threading
from time import time
import traceback
from typing import Iterator, Optional
from av import AudioFrame
import numpy as np
from videosdk import CustomAudioTrack
import logging

# from utils.struct.character_state import CharacterState

AUDIO_PTIME = 0.02

# Configure logging for audio stream track
logger = logging.getLogger(__name__)


class MediaStreamError(Exception):
    pass


class CustomAudioStreamTrack(CustomAudioTrack):
    def __init__(
        self, loop, handle_interruption: Optional[bool] = True
    ):
        super().__init__()
        logger.info("Initializing CustomAudioStreamTrack")
        
        self.loop = loop
        self._start = None
        self._timestamp = 0
        self.frame_buffer = []
        self.audio_data_buffer = bytearray()
        self.frame_time = 0
        self.sample_rate = 24000
        self.channels = 1
        self.sample_width = 2
        self.time_base_fraction = Fraction(1, self.sample_rate)
        self.samples = int(AUDIO_PTIME * self.sample_rate)
        self.chunk_size = int(self.samples * self.channels * self.sample_width)
        self._process_audio_task_queue = asyncio.Queue()
        self._process_audio_thread = threading.Thread(target=self.run_process_audio)
        self._process_audio_thread.daemon = True
        self._process_audio_thread.start()
        self.skip_next_chunk = False
        
        # Add performance tracking
        self.frames_processed = 0
        self.bytes_processed = 0
        self.start_time = time()
        
        logger.info(f"Audio track initialized - Sample rate: {self.sample_rate}, Channels: {self.channels}")
        logger.info(f"Chunk size: {self.chunk_size} bytes, Samples per frame: {self.samples}")

    def interrupt(self):
        logger.info("Interrupting audio stream")
        length = len(self.frame_buffer)
        self.frame_buffer.clear()
        while not self._process_audio_task_queue.empty():
            self.skip_next_chunk = True
            self._process_audio_task_queue.get_nowait()
            self._process_audio_task_queue.task_done()

        if length > 0:
            self.skip_next_chunk = True
            logger.info(f"Cleared {length} frames from buffer")

    async def add_new_bytes(self, audio_data_stream: Iterator[bytes]):
        logger.debug("Adding new audio bytes to processing queue")
        # self.interrupt()
        await self._process_audio_task_queue.put(audio_data_stream)

    def run_process_audio(self):
        logger.info("Starting audio processing thread")
        asyncio.run(self._process_audio())

    async def _process_audio(self):
        logger.info("Audio processing loop started")
        while True:
            try:
                # if (self._process_audio_task_queue.empty()) and (
                #     self.update_character_state is not None
                # ):
                    while True:
                        if len(self.frame_buffer) > 0:
                            await asyncio.sleep(0.1)
                            continue
                        # asyncio.run_coroutine_threadsafe(
                        #     self.update_character_state(
                        #         CharacterState.CHARACTER_LISTENING
                        #     ),
                        #     self.loop,
                        # )
                        break
            except Exception as e:
                logger.error(f"Error while updating character state: {e}")

            try:
                audio_data_stream = asyncio.run_coroutine_threadsafe(
                    self._process_audio_task_queue.get(), self.loop
                ).result()
                
                for audio_data in audio_data_stream:
                    try:
                        # if self.skip_next_chunk:
                        #     print("Skipping Next Chunk")
                        #     self.frame_buffer.clear()
                        #     self.skip_next_chunk = False
                        #     break
                        
                        self.audio_data_buffer += audio_data
                        self.bytes_processed += len(audio_data)
                        
                        while len(self.audio_data_buffer) > self.chunk_size:
                            chunk = self.audio_data_buffer[: self.chunk_size]
                            self.audio_data_buffer = self.audio_data_buffer[
                                self.chunk_size :
                            ]
                            audio_frame = self.buildAudioFrames(chunk)
                            self.frame_buffer.append(audio_frame)
                            self.frames_processed += 1
                            
                            # Log performance stats every 100 frames
                            if self.frames_processed % 100 == 0:
                                elapsed_time = time() - self.start_time
                                fps = self.frames_processed / elapsed_time if elapsed_time > 0 else 0
                                mb_processed = self.bytes_processed / (1024 * 1024)
                                logger.info(f"Audio processing stats - Frames: {self.frames_processed}, FPS: {fps:.2f}, MB processed: {mb_processed:.2f}")

                        # if self.update_character_state is not None:
                            # await self.update_character_state(
                            #     CharacterState.CHARACTER_SPEAKING
                            # )
                    except Exception as e:
                        logger.error(f"Error while processing audio data stream: {e}")
                        logger.error(f"Exception details: {traceback.format_exc()}")
            except Exception as e:
                logger.error(f"Error in audio processing loop: {e}")
                logger.error(f"Exception details: {traceback.format_exc()}")
                traceback.print_exc()

    def buildAudioFrames(self, chunk: bytes) -> AudioFrame:
        try:
            data = np.frombuffer(chunk, dtype=np.int16)
            data = data.reshape(-1, 1)
            audio_frame = AudioFrame.from_ndarray(data.T, format="s16", layout="mono")
            return audio_frame
        except Exception as e:
            logger.error(f"Error building audio frame: {e}")
            raise

    def next_timestamp(self):
        # Compute the next timestamp for the audio frame
        pts = int(self.frame_time)
        time_base = self.time_base_fraction
        self.frame_time += self.samples
        # self.chunk_size / self.channels / self.sample_width
        return pts, time_base

    async def recv(self) -> AudioFrame:
        try:
            if self.readyState != "live":
                logger.warning("Audio track not in live state")
                raise MediaStreamError

            if self._start is None:
                self._start = time()
                self._timestamp = 0
                logger.debug("Audio track started")
            else:
                self._timestamp += self.samples

            wait = self._start + (self._timestamp / self.sample_rate) - time()

            if wait > 0:
                await asyncio.sleep(wait)

            pts, time_base = self.next_timestamp()

            if len(self.frame_buffer) > 0:
                frame = self.frame_buffer.pop(0)
                logger.debug(f"Returning audio frame - Buffer size: {len(self.frame_buffer)}")
            else:
                logger.debug("Creating silent audio frame")
                frame = AudioFrame(format="s16", layout="mono", samples=self.samples)
                for p in frame.planes:
                    p.update(bytes(p.buffer_size))

            frame.pts = pts
            frame.time_base = time_base
            frame.sample_rate = self.sample_rate
            return frame
        except Exception as e:
            logger.error(f"Error in audio frame creation: {e}")
            logger.error(f"Exception details: {traceback.format_exc()}")
            traceback.print_exc()
            raise

