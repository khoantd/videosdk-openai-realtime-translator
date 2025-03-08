import React from "react";
import { MeetingProvider, useMeeting } from "@videosdk.live/react-sdk";
import { Toaster } from "react-hot-toast";
import { Languages, UserPlus, Users, Globe2 } from "lucide-react";
import useMeetingStore from "./store/meetingStore";
import ParticipantCard from "./components/ParticipantCard";
import MeetingControls from "./components/MeetingControls";
import toast from "react-hot-toast";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
];

interface MeetingViewProps {
  setMeetingId: (meetingId: string | null) => void;
}

const MeetingView = ({ setMeetingId }: MeetingViewProps) => {
  const { participants } = useMeeting();
  const { aiJoined: _aiJoined } = useMeetingStore();

  const isAIParticipant = (participantId: string) => {
    const participant = participants.get(participantId);
    const displayName = participant?.displayName?.toLowerCase() || "";
    return displayName.includes("ai") || displayName.includes("bot");
  };

  // Separate participants into AI and human
  const participantsList = [...participants.keys()];
  const aiParticipant = participantsList.find((id) => isAIParticipant(id));
  const humanParticipants = participantsList.filter(
    (id) => !isAIParticipant(id)
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8">
          {/* AI Participant Section */}
          {aiParticipant && (
            <div className="w-full max-w-3xl mx-auto">
              <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
                <Languages className="w-6 h-6 text-blue-400" />
                AI Translator
              </h2>
              <ParticipantCard
                participantId={aiParticipant}
                isAI={true}
                size="large"
              />
            </div>
          )}

          {/* Human Participants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {humanParticipants.map((participantId) => (
              <ParticipantCard
                key={participantId}
                participantId={participantId}
                isAI={false}
                size="normal"
              />
            ))}
          </div>
        </div>
      </div>
      <MeetingControls setMeetingId={setMeetingId} />
      <Toaster position="top-center" />
    </div>
  );
};

function App() {
  const { token } = useMeetingStore();
  const [meetingId, setMeetingId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState("");
  const [selectedLanguage, setSelectedLanguage] = React.useState(
    LANGUAGES[0].name
  );
  const [isCreatingMeeting, setIsCreatingMeeting] = React.useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = React.useState(false);
  const [joinMeetingId, setJoinMeetingId] = React.useState("");
  const [mode, setMode] = React.useState<"select" | "create" | "join">(
    "select"
  );
  const [_hasPermissions, setHasPermissions] = React.useState(false);

  // Request permissions before joining
  const requestPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setHasPermissions(true);
      return true;
    } catch (err) {
      console.error("Error getting permissions:", err);
      toast.error(
        "Please allow camera and microphone access to join the meeting"
      );
      return false;
    }
  };

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

    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) return;

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

    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) return;

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

  const renderContent = () => {
    if (mode === "select") {
      return (
        <div className="space-y-6">
          <button
            onClick={() => setMode("create")}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium transition-all duration-200 flex items-center justify-center space-x-3 hover:scale-[1.02]"
          >
            <UserPlus className="w-6 h-6" />
            <span>Create New Meeting</span>
          </button>
          <div className="relative flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-400 text-sm font-medium">Or</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>
          <button
            onClick={() => setMode("join")}
            className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 rounded-xl text-white font-medium transition-all duration-200 flex items-center justify-center space-x-3 hover:scale-[1.02]"
          >
            <Users className="w-6 h-6" />
            <span>Join Existing Meeting</span>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
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
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        <div>
          <label
            htmlFor="language"
            className="text-white text-sm font-medium mb-2 flex items-center gap-2"
          >
            <Globe2 className="w-4 h-4" />
            Select Your Language
          </label>
          <select
            id="language"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.name} value={lang.name}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {mode === "join" && (
          <div>
            <label
              htmlFor="meetingId"
              className="block text-white text-sm font-medium mb-2"
            >
              Meeting ID
            </label>
            <input
              type="text"
              id="meetingId"
              value={joinMeetingId}
              onChange={(e) => setJoinMeetingId(e.target.value.trim())}
              placeholder="Enter Meeting ID"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        )}

        <div className="space-y-4">
          {mode === "create" ? (
            <button
              onClick={createMeeting}
              disabled={!userName || isCreatingMeeting}
              className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-[1.02]"
            >
              {isCreatingMeeting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Create Meeting</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={joinMeeting}
              disabled={!userName || !joinMeetingId || isJoiningMeeting}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-[1.02]"
            >
              {isJoiningMeeting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  <span>Join Meeting</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setMode("select")}
            className="w-full px-6 py-4 bg-gray-800/50 hover:bg-gray-700 rounded-xl text-white font-medium transition-all duration-200 hover:scale-[1.02]"
          >
            Back
          </button>
        </div>
      </div>
    );
  };

  if (!meetingId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold text-white mb-6 flex items-center gap-3">
            <Languages className="w-10 h-10 text-blue-400" />
            Real-Time Translator Meeting
          </h1>
          <p className="text-gray-300 mb-8 max-w-md">
            Connect with others and break language barriers with our real-time
            translation feature.
          </p>
          <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-700/50">
            {renderContent()}
          </div>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: true,
        name: userName,
        debugMode: true,
        metaData: {
          preferredLanguage: selectedLanguage,
        },
      }}
      token={token}
      joinWithoutUserInteraction
    >
      <MeetingView setMeetingId={setMeetingId} />
    </MeetingProvider>
  );
}

export default App;
