import { useMeeting } from "@videosdk.live/react-sdk";
import { PhoneOff, UserPlus, Copy, Check } from "lucide-react";
import useMeetingStore from "../store/meetingStore";
import toast from "react-hot-toast";
import React from "react";

// Configure logging for MeetingControls
const log = (level: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
    component: 'MeetingControls'
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

interface MeetingControlsProps {
  setMeetingId: (meetingId: string | null) => void;
}

const MeetingControls = ({ setMeetingId }: MeetingControlsProps) => {
  const { end, meetingId } = useMeeting();
  const { token, aiJoined, setAiJoined } = useMeetingStore();
  const [isCopied, setIsCopied] = React.useState(false);

  log('info', 'MeetingControls rendered', { 
    meetingId, 
    aiJoined, 
    hasToken: !!token 
  });

  const inviteAI = async () => {
    log('info', 'Inviting AI translator', { meetingId });
    
    try {
      const requestBody = { meeting_id: meetingId, token };
      log('debug', 'Sending AI invite request', { 
        meetingId, 
        tokenLength: token?.length || 0 
      });
      
      const response = await fetch("http://127.0.0.1:8000/join-player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log('error', 'AI invite failed', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText
        });
        throw new Error("Failed to invite AI");
      }

      log('info', 'AI translator joined successfully');
      toast.success("AI Translator joined successfully");
      setAiJoined(true);
    } catch (error) {
      log('error', 'Failed to invite AI translator', { error });
      toast.error("Failed to invite AI Translator");
      console.error("Error inviting AI:", error);
    }
  };

  const copyMeetingId = () => {
    log('info', 'Copying meeting ID to clipboard', { meetingId });
    
    try {
      navigator.clipboard.writeText(meetingId || "");
      setIsCopied(true);
      log('info', 'Meeting ID copied successfully');
      toast.success("Meeting ID copied to clipboard");
      setTimeout(() => {
        setIsCopied(false);
        log('debug', 'Copy indicator reset');
      }, 2000);
    } catch (error) {
      log('error', 'Failed to copy meeting ID', { error });
      toast.error("Failed to copy meeting ID");
    }
  };

  const endMeeting = () => {
    log('info', 'Ending meeting', { meetingId });
    
    try {
      end();
      setMeetingId(null);
      log('info', 'Meeting ended successfully');
    } catch (error) {
      log('error', 'Failed to end meeting', { error });
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
      <div className="max-w-md mx-auto flex items-center justify-center space-x-4">
        <button
          onClick={copyMeetingId}
          className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          title="Copy Meeting ID"
        >
          {isCopied ? (
            <Check className="w-6 h-6 text-green-400" />
          ) : (
            <Copy className="w-6 h-6 text-white" />
          )}
        </button>

        {!aiJoined && (
          <button
            onClick={inviteAI}
            className="p-4 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
            title="Invite AI Translator"
          >
            <UserPlus className="w-6 h-6 text-white" />
          </button>
        )}

        <button
          onClick={endMeeting}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-6 h-6 text-white transform rotate-225" />
        </button>
      </div>
    </div>
  );
};

export default MeetingControls;
