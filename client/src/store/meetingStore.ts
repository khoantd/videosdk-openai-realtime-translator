import { create } from "zustand";

interface MeetingStore {
  token: string;
  aiJoined: boolean;
  setAiJoined: (joined: boolean) => void;
}

const useMeetingStore = create<MeetingStore>((set) => ({
  token: import.meta.env.VITE_APP_VIDEOSDK_TOKEN as string,
  aiJoined: false,
  setAiJoined: (joined) => set({ aiJoined: joined }),
}));

export default useMeetingStore;
