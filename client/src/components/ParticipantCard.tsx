import React from "react";
import { useParticipant } from "@videosdk.live/react-sdk";
import { Bot, User, Mic, MicOff } from "lucide-react";
import clsx from "clsx";

interface ParticipantCardProps {
  participantId: string;
  isAI?: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participantId,
  isAI,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const {
    isLocal,
    webcamStream,
    micStream,
    webcamOn,
    micOn,
    isActiveSpeaker,
    displayName,
  } = useParticipant(participantId);

  // Handle webcam stream
  React.useEffect(() => {
    if (videoRef.current && webcamStream && webcamOn) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error);
      });
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
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [micStream, micOn]);

  // Show animation for AI participant when speaking, visible to all participants
  const showAIAnimation = isAI && isActiveSpeaker;

  return (
    <div
      className={clsx(
        "relative rounded-lg overflow-hidden bg-gray-800 aspect-video",
        isActiveSpeaker &&
          (isAI ? "ring-2 ring-blue-500" : "ring-2 ring-green-500")
      )}
    >
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
          <div className="w-full h-full flex items-center justify-center bg-gray-700">
            <div className="relative">
              <div
                className={clsx(
                  "p-4 rounded-full relative z-10",
                  isAI ? "bg-blue-500/20" : "bg-gray-600"
                )}
              >
                {isAI ? (
                  <Bot className="w-16 h-16 text-blue-400" />
                ) : (
                  <User className="w-16 h-16 text-gray-400" />
                )}
              </div>
              {/* Enhanced AI Speaking Animation - visible to all participants */}
              {showAIAnimation && (
                <div className="absolute inset-0 -z-10">
                  {/* Inner wave */}
                  <div className="absolute inset-0 animate-wave-pulse-fast rounded-full bg-blue-400/30" />
                  {/* Middle waves */}
                  <div className="absolute -inset-4 animate-wave-pulse-medium rounded-full bg-blue-400/20" />
                  <div className="absolute -inset-8 animate-wave-pulse-medium-delayed rounded-full bg-blue-400/15" />
                  {/* Outer waves */}
                  <div className="absolute -inset-12 animate-wave-pulse-slow rounded-full bg-blue-400/10" />
                  <div className="absolute -inset-16 animate-wave-pulse-slow-delayed rounded-full bg-blue-400/5" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <audio ref={audioRef} autoPlay playsInline muted={isLocal} />

      <div
        className={clsx(
          "absolute bottom-0 left-0 right-0 p-3",
          "bg-gradient-to-t from-black/80 to-transparent",
          showAIAnimation && "from-blue-900/80"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={clsx(
                "p-1.5 rounded-full",
                isAI ? "bg-blue-500/20" : "bg-gray-500/20"
              )}
            >
              {isAI ? (
                <Bot className="w-4 h-4 text-blue-400" />
              ) : (
                <User className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <span className="text-white font-medium">
              {displayName} {isLocal && "(You)"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isActiveSpeaker && (
              <span
                className={clsx(
                  "px-2 py-0.5 text-xs rounded-full text-white",
                  isAI ? "bg-blue-500" : "bg-green-500"
                )}
              >
                Speaking
              </span>
            )}
            {micOn ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <MicOff className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantCard;
