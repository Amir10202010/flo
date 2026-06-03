'use client'

import { create } from 'zustand'

interface InboxState {
    selectedConversationId?: string | null
    setSelected: (id?: string | null) => void
}

export const useInboxStore = create<InboxState>((set) => ({
    selectedConversationId: null,
    setSelected: (id) => set({ selectedConversationId: id ?? null }),
}))
