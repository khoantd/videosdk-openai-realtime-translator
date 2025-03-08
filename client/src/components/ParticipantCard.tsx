import React from "react";
import { useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import { Bot, User, Mic, MicOff } from "lucide-react";
import clsx from "clsx";

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

  // Handle push-to-talk
  React.useEffect(() => {
    if (!isLocal || isAI) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isSpeaking) {
        e.preventDefault();
        setIsSpeaking(true);
        unmuteMic();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpeaking(false);
        muteMic();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isLocal, isAI, isSpeaking, unmuteMic, muteMic]);

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
        }
      });
    }
  }, [isLocal, isAI, isActiveSpeaker, muteMic]);

  // Handle webcam stream
  React.useEffect(() => {
    if (videoRef.current && webcamStream && webcamOn) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(console.error);
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [webcamStream, webcamOn]);

  // Handle audio stream
  React.useEffect(() => {
    if (audioRef.current && micStream && micOn) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(micStream.track);
      audioRef.current.srcObject = mediaStream;
      audioRef.current.play().catch(console.error);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [micStream, micOn]);

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
              }}
              onMouseUp={() => {
                setIsSpeaking(false);
                muteMic();
              }}
              onMouseLeave={() => {
                if (isSpeaking) {
                  setIsSpeaking(false);
                  muteMic();
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
