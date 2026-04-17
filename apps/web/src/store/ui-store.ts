import { create } from "zustand";

type Tab = "DAILY" | "WEEKLY" | "SEASON";

type UiState = {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
};

export const useUiStore = create<UiState>((set) => ({
    activeTab: "DAILY",
    setActiveTab: (tab) => set({ activeTab: tab }),
}));
