'use client'

import { create } from 'zustand'

interface UiState {
    paletteOpen: boolean
    setPaletteOpen: (open: boolean) => void
    togglePalette: () => void
    composeOpen: boolean
    setComposeOpen: (open: boolean) => void
    assistantOpen: boolean
    setAssistantOpen: (open: boolean) => void
    tourOpen: boolean
    setTourOpen: (open: boolean) => void
    startTour: () => void
}

/** Cross-component UI state: the ⌘K command palette (sidebar button + global
 *  shortcut), the Smart Compose modal (inbox header + palette action), the Ask
 *  Velnox AI assistant overlay (sidebar button + palette action) and the
 *  onboarding spotlight tour (auto-run on first visit + replay from Settings /
 *  the palette). */
export const useUiStore = create<UiState>((set) => ({
    paletteOpen: false,
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
    composeOpen: false,
    setComposeOpen: (open) => set({ composeOpen: open }),
    assistantOpen: false,
    setAssistantOpen: (open) => set({ assistantOpen: open }),
    tourOpen: false,
    setTourOpen: (open) => set({ tourOpen: open }),
    startTour: () => set({ tourOpen: true }),
}))
