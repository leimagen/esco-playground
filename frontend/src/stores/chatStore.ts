import { create } from 'zustand'
import { Thread, Message } from '../api/chat'

interface ChatState {
  threads: Thread[]
  activeThreadId: number | null
  messages: Record<number, Message[]>
  streaming: boolean

  setThreads: (threads: Thread[]) => void
  setActiveThread: (id: number | null) => void
  addThread: (thread: Thread) => void
  removeThread: (id: number) => void

  setMessages: (threadId: number, messages: Message[]) => void
  appendMessage: (threadId: number, message: Message) => void
  updateStreamingMessage: (threadId: number, messageId: number, token: string) => void
  finalizeMessage: (threadId: number, messageId: number) => void

  setStreaming: (streaming: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  threads: [],
  activeThreadId: null,
  messages: {},
  streaming: false,

  setThreads: (threads) => set({ threads }),
  setActiveThread: (id) => set({ activeThreadId: id }),
  addThread: (thread) => set((s) => ({ threads: [thread, ...s.threads] })),
  removeThread: (id) =>
    set((s) => ({
      threads: s.threads.filter((t) => t.id !== id),
      activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
    })),

  setMessages: (threadId, messages) =>
    set((s) => ({ messages: { ...s.messages, [threadId]: messages } })),

  appendMessage: (threadId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: [...(s.messages[threadId] ?? []), message],
      },
    })),

  updateStreamingMessage: (threadId, messageId, token) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] ?? []).map((m) =>
          m.id === messageId ? { ...m, content: m.content + token } : m
        ),
      },
    })),

  finalizeMessage: (threadId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] ?? []).map((m) =>
          m.id === messageId ? { ...m, streaming: false } : m
        ),
      },
    })),

  setStreaming: (streaming) => set({ streaming }),
}))
