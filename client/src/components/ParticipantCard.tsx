import React from "react";
import { useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import { Bot, User, Mic, MicOff } from "lucide-react";
import clsx from "clsx";

// Configure logging for ParticipantCard
const log = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
    component: 'ParticipantCard'
  };
  
  // Log to console
  console.log(`[${timestamp}] [${level}] ${message}`, data || '');
  
  // Store in localStorage for persistence
  try {
    const logs = JSON.parse(localStorage.getItem('frontend_logs') || '[]');
    logs.push(logEntry);
    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    localStorage.setItem('frontend_logs', JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to store log:', e);
  }
};

interface ParticipantCardProps {
  participantId: string;
  isAI?: boolean;
  size?: "normal" | "large";
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participantId,
  isAI,
  size = "normal",
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const {
    isLocal,
    webcamStream,
    micStream,
    webcamOn,
    micOn,
    isActiveSpeaker,
    displayName,
  } = useParticipant(participantId);
  const { muteMic, unmuteMic } = useMeeting();

  log('info', 'ParticipantCard rendered', { 
    participantId, 
    isAI, 
    size, 
    isLocal, 
    displayName,
    webcamOn,
    micOn,
    isActiveSpeaker
  });

  // Handle push-to-talk
  React.useEffect(() => {
    if (!isLocal || isAI) return;

    log('info', 'Setting up push-to-talk for local participant', { participantId });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isSpeaking) {
        e.preventDefault();
        setIsSpeaking(true);
        unmuteMic();
        log('info', 'Push-to-talk activated (keyboard)', { participantId });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpeaking(false);
        muteMic();
        log('info', 'Push-to-talk deactivated (keyboard)', { participantId });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      log('debug', 'Push-to-talk event listeners removed', { participantId });
    };
  }, [isLocal, isAI, isSpeaking, unmuteMic, muteMic, participantId]);

  // Auto-mute when AI starts speaking
  React.useEffect(() => {
    if (isLocal && !isAI && isActiveSpeaker) {
      const aiParticipants = document.querySelectorAll(
        '[data-ai-participant="true"]'
      );
      aiParticipants.forEach((ai) => {
        if (ai.getAttribute("data-is-speaking") === "true") {
          muteMic();
          setIsSpeaking(false);
          log('info', 'Auto-muted local participant due to AI speaking', { participantId });
        }
      });
    }
  }, [isLocal, isAI, isActiveSpeaker, muteMic, participantId]);

  // Handle webcam stream
  React.useEffect(() => {
    if (videoRef.current && webcamStream && webcamOn) {
      log('info', 'Setting up webcam stream', { participantId, isLocal });
      
      try {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(webcamStream.track);
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((error) => {
          log('error', 'Failed to play webcam stream', { participantId, error });
          console.error(error);
        });
      } catch (error) {
        log('error', 'Failed to setup webcam stream', { participantId, error });
      }
    } else {
      log('debug', 'Clearing webcam stream', { participantId, hasStream: !!webcamStream, webcamOn });
    }
    
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        log('debug', 'Webcam stream cleaned up', { participantId });
      }
    };
  }, [webcamStream, webcamOn, participantId, isLocal]);

  // Handle audio stream
  React.useEffect(() => {
    if (audioRef.current && micStream && micOn) {
      log('info', 'Setting up audio stream', { participantId, isLocal });
      
      try {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(micStream.track);
        audioRef.current.srcObject = mediaStream;
        audioRef.current.play().catch((error) => {
          log('error', 'Failed to play audio stream', { participantId, error });
          console.error(error);
        });
      } catch (error) {
        log('error', 'Failed to setup audio stream', { participantId, error });
      }
    } else {
      log('debug', 'Clearing audio stream', { participantId, hasStream: !!micStream, micOn });
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        log('debug', 'Audio stream cleaned up', { participantId });
      }
    };
  }, [micStream, micOn, participantId, isLocal]);

  // Log speaking state changes
  React.useEffect(() => {
    const speakingState = isActiveSpeaker || isSpeaking;
    log('debug', 'Speaking state changed', { 
      participantId, 
      isActiveSpeaker, 
      isSpeaking, 
      speakingState 
    });
  }, [isActiveSpeaker, isSpeaking, participantId]);

  const showAIAnimation = isAI && isActiveSpeaker;
  const isParticipantSpeaking = isActiveSpeaker || isSpeaking;

  return (
    <div
      className={clsx(
        "relative rounded-xl overflow-hidden bg-gray-800/50 backdrop-blur-sm group",
        size === "large" ? "aspect-[16/9]" : "aspect-video",
        isParticipantSpeaking && "ring-2",
        isAI ? "ring-blue-500" : "ring-green-500",
        size === "large" && "shadow-2xl"
      )}
      data-ai-participant={isAI}
      data-is-speaking={isActiveSpeaker}
    >
      {/* Speaking Status Indicator */}
      <div
        className={clsx(
          "absolute top-4 left-4 z-20 transition-all duration-300",
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          isParticipantSpeaking
            ? isAI
              ? "bg-blue-500/90"
              : "bg-green-500/90"
            : "bg-gray-800/90 opacity-0 group-hover:opacity-100"
        )}
      >
        {isParticipantSpeaking ? (
          <Mic className="w-4 h-4 text-white animate-pulse" />
        ) : (
          <MicOff className="w-4 h-4 text-gray-300" />
        )}
        <span className="text-white text-sm font-medium">
          {isParticipantSpeaking ? "Speaking" : "Not Speaking"}
        </span>
      </div>

      <div className="absolute inset-0">
        {webcamOn && webcamStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="relative">
              <div
                className={clsx(
                  "p-4 rounded-full relative z-10",
                  isAI ? "bg-blue-500/20" : "bg-gray-600/20"
                )}
              >
                {isAI ? (
                  <Bot
                    className={clsx(
                      "text-blue-400",
                      size === "large" ? "w-24 h-24" : "w-16 h-16"
                    )}
                  />
                ) : (
                  <User
                    className={clsx(
                      "text-gray-400",
                      size === "large" ? "w-24 h-24" : "w-16 h-16"
                    )}
                  />
                )}
              </div>
              {(showAIAnimation || isSpeaking) && (
                <div className="absolute inset-0 -z-10">
                  <div className="absolute inset-0 animate-wave-pulse-fast rounded-full bg-blue-400/30" />
                  <div className="absolute -inset-4 animate-wave-pulse-medium rounded-full bg-blue-400/20" />
                  <div className="absolute -inset-8 animate-wave-pulse-slow rounded-full bg-blue-400/10" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <audio ref={audioRef} autoPlay playsInline muted={isLocal} />

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={clsx(
                "p-2 rounded-full",
                isAI ? "bg-blue-500/20" : "bg-gray-500/20"
              )}
            >
              {isAI ? (
                <Bot className="w-5 h-5 text-blue-400" />
              ) : (
                <User className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <span className="text-white font-medium text-lg">
              {displayName} {isLocal && "(You)"}
            </span>
          </div>
          {isLocal && !isAI && (
            <button
              onMouseDown={() => {
                setIsSpeaking(true);
                unmuteMic();
                log('info', 'Push-to-talk activated (mouse)', { participantId });
              }}
              onMouseUp={() => {
                setIsSpeaking(false);
                muteMic();
                log('info', 'Push-to-talk deactivated (mouse)', { participantId });
              }}
              onMouseLeave={() => {
                if (isSpeaking) {
                  setIsSpeaking(false);
                  muteMic();
                  log('info', 'Push-to-talk deactivated (mouse leave)', { participantId });
                }
              }}
              className={clsx(
                "px-4 py-2 rounded-full transition-all duration-300",
                isSpeaking
                  ? "bg-green-500 text-white scale-105"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              )}
            >
              Hold to Speak
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParticipantCard;
