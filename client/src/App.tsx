import React from "react";
import { MeetingProvider, useMeeting } from "@videosdk.live/react-sdk";
import { Toaster } from "react-hot-toast";
import { User, Languages } from "lucide-react";
import useMeetingStore from "./store/meetingStore";
import ParticipantCard from "./components/ParticipantCard";
import TranslationPanel from "./components/TranslationPanel";
import MeetingControls from "./components/MeetingControls";
import toast from "react-hot-toast";

interface MeetingViewProps {
  setMeetingId: (meetingId: string | null) => void;
}

const MeetingView = ({ setMeetingId }: MeetingViewProps) => {
  const { participants } = useMeeting();
  const { aiJoined } = useMeetingStore();

  // Identify AI participant by checking if the display name includes "AI" or "Bot"
  const isAIParticipant = (participantId: string) => {
    const participant = participants.get(participantId);
    const displayName = participant?.displayName?.toLowerCase() || "";
    return displayName.includes("ai") || displayName.includes("bot");
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(rgba(225, 225, 225, 0.2), rgba(225, 225, 225, 0.2)), url('https://images.unsplash.com/photo-1628544106915-0d756c7dadfa?q=80&w=2832&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')`,
      }}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...participants.keys()].map((participantId) => (
                <ParticipantCard
                  key={participantId}
                  participantId={participantId}
                  isAI={aiJoined && isAIParticipant(participantId)}
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-1">
            <TranslationPanel />
          </div>
        </div>
        <MeetingControls setMeetingId={setMeetingId} />
      </div>
      <Toaster position="top-center" />
    </div>
  );
};

function App() {
  const { token } = useMeetingStore();
  const [meetingId, setMeetingId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState("");
  const [isCreatingMeeting, setIsCreatingMeeting] = React.useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = React.useState(false);
  const [joinMeetingId, setJoinMeetingId] = React.useState("");

  const validateMeetingId = async (roomId: string) => {
    try {
      const response = await fetch(
        `https://api.videosdk.live/v2/rooms/validate/${roomId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `${token}`,
          },
        }
      );
      return response.ok;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const createMeeting = async () => {
    if (!userName) {
      toast.error("Please enter your name");
      return;
    }

    setIsCreatingMeeting(true);
    try {
      const response = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: {
          Authorization: `${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create meeting");
      }

      const data = await response.json();
      setMeetingId(data.roomId);
      toast.success("Meeting created successfully!");
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Failed to create meeting");
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const joinMeeting = async () => {
    if (!userName) {
      toast.error("Please enter your name");
      return;
    }
    if (!joinMeetingId) {
      toast.error("Please enter a meeting ID");
      return;
    }

    setIsJoiningMeeting(true);
    try {
      const isValid = await validateMeetingId(joinMeetingId);
      if (!isValid) {
        toast.error("Invalid meeting ID");
        return;
      }
      setMeetingId(joinMeetingId);
      toast.success("Joined meeting successfully!");
    } catch (error) {
      console.error("Error joining meeting:", error);
      toast.error("Failed to join meeting");
    } finally {
      setIsJoiningMeeting(false);
    }
  };

  if (!meetingId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-75"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1628544106915-0d756c7dadfa?q=80&w=2832&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold text-white mb-6 flex items-center gap-3">
            <Languages className="w-10 h-10" />
            Real-Time Translator Meeting
          </h1>
          <p className="text-gray-300 mb-8 max-w-md">
            Connect with others and break language barriers with our real-time
            translation feature.
          </p>
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mb-6">
            <div className="mb-6">
              <label
                htmlFor="userName"
                className="block text-white text-sm font-medium mb-2"
              >
                Enter Your Name
              </label>
              <input
                type="text"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value.trim())}
                placeholder="Your name"
                className="w-full px-4 py-2 mb-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={joinMeetingId}
                onChange={(e) => setJoinMeetingId(e.target.value.trim())}
                placeholder="Enter Meeting ID"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-4">
              <button
                onClick={createMeeting}
                disabled={!userName || isCreatingMeeting}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {isCreatingMeeting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <User className="w-5 h-5" />
                    <span>Create New Meeting</span>
                  </>
                )}
              </button>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">Or</span>
              </div>
              <button
                onClick={joinMeeting}
                disabled={!userName || !joinMeetingId || isJoiningMeeting}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {isJoiningMeeting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  "Join Meeting"
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: userName,
        debugMode: true,
      }}
      token={token}
      joinWithoutUserInteraction
    >
      <MeetingView setMeetingId={setMeetingId} />
    </MeetingProvider>
  );
}

export default App;
