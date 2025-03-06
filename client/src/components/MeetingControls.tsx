import { useMeeting } from "@videosdk.live/react-sdk";
import {
  PhoneOff,
  UserPlus,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Copy,
  Check,
} from "lucide-react";
import useMeetingStore from "../store/meetingStore";
import toast from "react-hot-toast";
import React from "react";

interface MeetingControlsProps {
  setMeetingId: (meetingId: string | null) => void;
}

const MeetingControls = ({ setMeetingId }: MeetingControlsProps) => {
  const { end, meetingId, toggleMic, toggleWebcam, localMicOn, localWebcamOn } =
    useMeeting();
  const { token, aiJoined, setAiJoined } = useMeetingStore();
  const [isCopied, setIsCopied] = React.useState(false);

  const inviteAI = async () => {
    try {
      const response = await fetch("http://localhost:8000/join-player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meeting_id: meetingId, token }),
      });

      if (!response.ok) throw new Error("Failed to invite AI");

      toast.success("AI Translator joined successfully");
      setAiJoined(true);
    } catch (error) {
      toast.error("Failed to invite AI Translator");
      console.error("Error inviting AI:", error);
    }
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId || "");
    setIsCopied(true);
    toast.success("Meeting ID copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={copyMeetingId}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Copy Meeting ID"
        >
          {isCopied ? (
            <Check className="w-6 h-6 text-green-400" />
          ) : (
            <Copy className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={() => toggleMic()}
          className={`p-3 rounded-full ${
            localMicOn
              ? "bg-gray-700 hover:bg-gray-600"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {localMicOn ? (
            <Mic className="w-6 h-6 text-white" />
          ) : (
            <MicOff className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={() => toggleWebcam()}
          className={`p-3 rounded-full ${
            localWebcamOn
              ? "bg-gray-700 hover:bg-gray-600"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {localWebcamOn ? (
            <Video className="w-6 h-6 text-white" />
          ) : (
            <VideoOff className="w-6 h-6 text-white" />
          )}
        </button>

        {!aiJoined && (
          <button
            onClick={inviteAI}
            className="p-3 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
            title="Invite AI Translator"
          >
            <UserPlus className="w-6 h-6 text-white" />
          </button>
        )}

        <button
          onClick={() => {
            end();
            setMeetingId(null);
          }}
          className="p-3 rounded-full bg-red-500 hover:bg-red-600"
        >
          <PhoneOff className="w-6 h-6 text-white transform rotate-225" />
        </button>
      </div>
    </div>
  );
};

export default MeetingControls;
