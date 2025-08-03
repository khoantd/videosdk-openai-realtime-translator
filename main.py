from dotenv import load_dotenv
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, BackgroundTasks, Request
from pydantic import BaseModel
from agent.ai_agent import AIAgent
import asyncio
import logging
import time
from datetime import datetime
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

port = 8000
app = FastAPI()

# Add logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log request details
    logger.info(f"REQUEST: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    # Log request body if present
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.body()
            if body:
                logger.info(f"Request Body: {body.decode()}")
        except Exception as e:
            logger.warning(f"Could not read request body: {e}")
    
    # Process request
    response = await call_next(request)
    
    # Log response details
    process_time = time.time() - start_time
    logger.info(f"RESPONSE: {response.status_code} - Processed in {process_time:.4f}s")
    
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_agent = None


class MeetingReqConfig(BaseModel):
    meeting_id: str
    token: str


async def server_operations(req: MeetingReqConfig):
    # join ai agent
    # keep server alive
    global ai_agent
    
    logger.info(f"Starting AI Agent for meeting: {req.meeting_id}")
    logger.info(f"Token: {req.token[:20]}...")  # Log partial token for security
    
    ai_agent = AIAgent(req.meeting_id, req.token, "AI")

    try:
        logger.info("Attempting to join meeting...")
        await ai_agent.join()
        logger.info("Successfully joined meeting")
        
        while True:
            await asyncio.sleep(1)
            # print("Server is running is background")
    except Exception as ex:
        logger.error(f"Error in server operations: {ex}")
        logger.error(f"Exception details: {type(ex).__name__}: {str(ex)}")
    finally:
        logger.info("Leaving meeting and cleaning up")
        ai_agent.leave()


@app.get("/test")
async def test():
    logger.info("Health check endpoint called")
    return {"message": "CORS is working!"}


# join ai agent
@app.post("/join-player")
async def join_player(req: MeetingReqConfig, bg_tasks: BackgroundTasks):
    logger.info(f"Received join request for meeting: {req.meeting_id}")
    logger.info(f"Request details: {req.dict()}")
    
    try:
        bg_tasks.add_task(server_operations, req)
        logger.info("AI agent join task added to background tasks")
        return {"message": "AI agent joined"}
    except Exception as e:
        logger.error(f"Error adding AI agent to meeting: {e}")
        raise


# runnning the server on port : 8000
if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting server on port {port}")
    uvicorn.run("main:app", host="127.0.0.1", port=port)
