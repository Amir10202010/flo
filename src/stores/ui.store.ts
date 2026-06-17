'use client'

import { create } from 'zustand'

interface UiState {
    paletteOpen: boolean
    setPaletteOpen: (open: boolean) => void
    togglePalette: () => void
    composeOpen: boolean
    setComposeOpen: (open: boolean) => void
}

/** Cross-component UI state: the ⌘K command palette (sidebar button + global
 *  shortcut) and the Smart Compose modal (inbox header + palette action). */
export const useUiStore = create<UiState>((set) => ({
    paletteOpen: false,
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
    composeOpen: false,
    setComposeOpen: (open) => set({ composeOpen: open }),
}))
