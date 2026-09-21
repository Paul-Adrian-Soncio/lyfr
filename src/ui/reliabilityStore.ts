// UI state for the missed-fire banner. See CLAUDE.md §3 — "If fires are
// being missed, show a persistent banner."

import { create } from "zustand";

interface ReliabilityState {
  suspectedMissCount: number;
  setSuspectedMissCount: (count: number) => void;
}

export const useReliabilityStore = create<ReliabilityState>((set) => ({
  suspectedMissCount: 0,
  setSuspectedMissCount: (count) => set({ suspectedMissCount: count }),
}));
