import { create } from 'zustand'
import { agentsApi, Agent } from '../api/agents'

interface AgentState {
  agents: Agent[]
  loading: boolean
  fetchAgents: () => Promise<void>
  addAgent: (agent: Agent) => void
  updateAgent: (agent: Agent) => void
  removeAgent: (id: number) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  loading: false,

  fetchAgents: async () => {
    set({ loading: true })
    try {
      const agents = await agentsApi.list()
      set({ agents, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),

  updateAgent: (agent) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === agent.id ? agent : a)),
    })),

  removeAgent: (id) =>
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
}))
