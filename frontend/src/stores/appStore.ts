import { create } from 'zustand'

interface AppState {
  showLogs: boolean
  backendReady: boolean
  backendLogs: string[]
  toggleLogs: () => void
  setBackendReady: (ready: boolean) => void
  addLog: (line: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  showLogs: false,
  backendReady: false,
  backendLogs: [],

  toggleLogs: () => set((s) => ({ showLogs: !s.showLogs })),

  setBackendReady: (ready) => set({ backendReady: ready }),

  addLog: (line) =>
    set((s) => ({
      backendLogs: [...s.backendLogs.slice(-500), line],
    })),
}))

if (typeof window !== 'undefined' && (window as any).escoAPI) {
  const api = (window as any).escoAPI
  api.onBackendLog((line: string) => {
    useAppStore.getState().addLog(line)
  })
  api.onBackendReady(() => {
    useAppStore.getState().setBackendReady(true)
  })
}
