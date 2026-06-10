'use client'

import { create } from 'zustand'

interface UiState {
    paletteOpen: boolean
    setPaletteOpen: (open: boolean) => void
    togglePalette: () => void
}

/** Cross-component UI state: the ⌘K command palette is opened from the
 *  sidebar button and the global keyboard shortcut. */
export const useUiStore = create<UiState>((set) => ({
    paletteOpen: false,
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
}))
