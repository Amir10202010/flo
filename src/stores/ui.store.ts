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
    alertsOpen: boolean
    setAlertsOpen: (open: boolean) => void
}

/** Cross-component UI state: the ⌘K command palette (sidebar button + global
 *  shortcut), the Smart Compose modal (inbox header + palette action) and the
 *  Ask Velnox AI assistant overlay (sidebar button + palette action). */
export const useUiStore = create<UiState>((set) => ({
    paletteOpen: false,
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
    composeOpen: false,
    setComposeOpen: (open) => set({ composeOpen: open }),
    assistantOpen: false,
    setAssistantOpen: (open) => set({ assistantOpen: open }),
    alertsOpen: false,
    setAlertsOpen: (open) => set({ alertsOpen: open }),
}))
