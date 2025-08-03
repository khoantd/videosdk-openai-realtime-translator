# Logging System Documentation

This document describes the comprehensive logging system implemented for the VideoSDK OpenAI Realtime Translator project.

## Overview

The logging system captures all interactions between the backend and frontend components, providing detailed insights into:
- HTTP requests and responses
- Meeting events and participant interactions
- Audio processing and translation pipeline
- User interactions and UI events
- Error handling and debugging information

## Logging Components

### Backend Logging

#### 1. **Main Server** (`main.py`)
- **HTTP Request/Response Logging**: All incoming requests and outgoing responses
- **Meeting Operations**: AI agent joining/leaving meetings
- **Error Handling**: Comprehensive error logging with stack traces
- **Performance Metrics**: Request processing times

**Log File**: `backend.log`

#### 2. **AI Agent** (`agent/ai_agent.py`)
- **Meeting Events**: Join/leave events, participant management
- **Audio Processing**: Frame processing statistics and performance metrics
- **Translation Setup**: Dynamic instruction generation and OpenAI configuration
- **Stream Management**: Audio stream enable/disable events

#### 3. **OpenAI Intelligence** (`intelligence/openai/openai_intelligence.py`)
- **WebSocket Communication**: Connection establishment and message handling
- **Audio Processing**: Frame sending statistics and response handling
- **Session Management**: Session creation, updates, and instruction changes
- **Error Handling**: OpenAI API errors and connection issues

#### 4. **Audio Stream Track** (`agent/audio_stream_track.py`)
- **Audio Processing**: Frame creation, buffering, and streaming
- **Performance Metrics**: FPS, data processed, buffer management
- **Error Handling**: Audio processing errors and recovery

### Frontend Logging

#### 1. **Main App** (`client/src/App.tsx`)
- **User Interactions**: Meeting creation, joining, language selection
- **API Calls**: VideoSDK API interactions and validation
- **Permission Handling**: Camera/microphone access requests
- **State Management**: Application state changes

#### 2. **Meeting Controls** (`client/src/components/MeetingControls.tsx`)
- **AI Invitation**: AI translator invitation process
- **Meeting Management**: End call, copy meeting ID
- **Error Handling**: API call failures and user feedback

#### 3. **Participant Card** (`client/src/components/ParticipantCard.tsx`)
- **Media Streams**: Audio/video stream setup and management
- **Speaking Events**: Push-to-talk activation, speaking state changes
- **Participant Interactions**: Participant join/leave, stream enable/disable

## Log Storage

### Backend Logs
- **File**: `backend.log`
- **Format**: Standard Python logging format
- **Rotation**: Manual (logs accumulate in single file)

### Frontend Logs
- **Storage**: Browser localStorage
- **Format**: JSON with timestamp, level, message, and data
- **Persistence**: Survives browser sessions
- **Limit**: Last 1000 logs (automatic cleanup)

## Log Levels

### Backend
- **ERROR**: Critical errors and exceptions
- **WARN**: Warning conditions
- **INFO**: General information and state changes
- **DEBUG**: Detailed debugging information

### Frontend
- **error**: Error conditions and failures
- **warn**: Warning conditions
- **info**: General information and user actions
- **debug**: Detailed debugging information

## Log Viewer Utility

A Python utility script (`log_viewer.py`) is provided to analyze and export logs.

### Usage Examples

```bash
# View all logs
python log_viewer.py

# View only error logs
python log_viewer.py --level ERROR

# View logs from specific component
python log_viewer.py --component "ai_agent"

# View only backend logs
python log_viewer.py --source backend

# Search for specific messages
python log_viewer.py --search "meeting joined"

# Show last 50 logs
python log_viewer.py --limit 50

# Export logs to JSON
python log_viewer.py --export logs.json --no-display

# Show log summary
python log_viewer.py --summary
```

### Advanced Filtering

```bash
# View AI agent errors only
python log_viewer.py --component "ai_agent" --level ERROR

# View frontend user interactions
python log_viewer.py --source frontend --search "user"

# View audio processing performance
python log_viewer.py --search "audio processing stats"
```

## Key Log Events

### Meeting Lifecycle
```
INFO - Meeting creation initiated
INFO - Meeting created successfully
INFO - Participant joined meeting
INFO - AI agent invited to meeting
INFO - Translation setup completed
INFO - Meeting ended
```

### Audio Processing
```
INFO - Audio listener started for participant
INFO - Audio processing stats - Frames: 100, FPS: 25.5
INFO - OpenAI WebSocket connection established
INFO - Audio delta received: 1024 bytes
```

### User Interactions
```
INFO - User created meeting
INFO - User joined meeting
INFO - Push-to-talk activated
INFO - AI translator invited
INFO - Meeting ID copied to clipboard
```

### Error Handling
```
ERROR - Failed to establish WebSocket connection
ERROR - Audio processing error for participant
ERROR - Meeting creation failed
ERROR - Media permissions denied
```

## Performance Monitoring

The logging system includes performance metrics for:

### Audio Processing
- **FPS**: Frames per second processing rate
- **Data Volume**: Megabytes of audio processed
- **Buffer Management**: Frame buffer statistics

### Network Communication
- **Request Times**: HTTP request processing times
- **WebSocket Performance**: Connection stability and message rates
- **API Response Times**: VideoSDK and OpenAI API response times

### User Experience
- **Meeting Creation Time**: Time to create and join meetings
- **Translation Latency**: Time from speech to translated audio
- **UI Responsiveness**: Component render times and state changes

## Debugging Features

### Backend Debugging
- **Stack Traces**: Full exception stack traces
- **Request/Response Logging**: Complete HTTP transaction details
- **State Tracking**: Meeting and participant state changes

### Frontend Debugging
- **Component Lifecycle**: Component mount/unmount events
- **State Changes**: React state updates and effects
- **User Interactions**: All user actions and their results

## Log Analysis Examples

### Troubleshooting Connection Issues
```bash
# Check for connection errors
python log_viewer.py --level ERROR --search "connection"

# View WebSocket communication
python log_viewer.py --component "openai_intelligence" --search "websocket"
```

### Performance Analysis
```bash
# View audio processing performance
python log_viewer.py --search "audio processing stats"

# Check request processing times
python log_viewer.py --search "Processed in"
```

### User Experience Analysis
```bash
# View user interactions
python log_viewer.py --source frontend --search "user"

# Check meeting lifecycle
python log_viewer.py --search "meeting"
```

## Best Practices

### For Developers
1. **Use Appropriate Log Levels**: Use ERROR for errors, INFO for state changes, DEBUG for detailed info
2. **Include Context**: Always include relevant data in log messages
3. **Avoid Sensitive Data**: Don't log API keys, tokens, or personal information
4. **Performance Impact**: Be mindful of logging overhead in performance-critical sections

### For Operations
1. **Regular Monitoring**: Check logs regularly for errors and performance issues
2. **Log Rotation**: Consider implementing log rotation for production deployments
3. **Alerting**: Set up alerts for critical errors and performance degradation
4. **Backup**: Regularly export and backup logs for analysis

## Configuration

### Backend Logging Configuration
```python
# In main.py
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend.log'),
        logging.StreamHandler()
    ]
)
```

### Frontend Logging Configuration
```javascript
// Log storage in localStorage with automatic cleanup
const logs = JSON.parse(localStorage.getItem('frontend_logs') || '[]');
logs.push(logEntry);
if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
}
localStorage.setItem('frontend_logs', JSON.stringify(logs));
```

## Future Enhancements

1. **Structured Logging**: Implement structured logging with consistent JSON format
2. **Log Aggregation**: Centralized log collection and analysis
3. **Real-time Monitoring**: Live log streaming and alerting
4. **Performance Dashboards**: Web-based log analysis and visualization
5. **Log Compression**: Automatic log compression and archival

This comprehensive logging system provides complete visibility into the application's behavior, making debugging, performance optimization, and user experience analysis much more effective. 