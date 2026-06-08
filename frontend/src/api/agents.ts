import { apiClient } from './client'

export interface Agent {
  id: number
  name: string
  slug: string
  persona: string
  model_id: string
  vision: boolean
  color: string
  has_avatar: boolean
  created_at: string
  updated_at?: string
}

export interface AgentSkill {
  id: number
  agent_id: number
  topic: string
  conversation_count: number
  confidence_score: number
}

export interface CreateAgentPayload {
  name: string
  persona: string
  model_id: string
  vision?: boolean
  color?: string
}

export const agentsApi = {
  list: async (): Promise<Agent[]> => {
    const res = await apiClient.get('/agents')
    return res.data
  },

  get: async (id: number): Promise<Agent> => {
    const res = await apiClient.get(`/agents/${id}`)
    return res.data
  },

  create: async (payload: CreateAgentPayload): Promise<Agent> => {
    const res = await apiClient.post('/agents', payload)
    return res.data
  },

  update: async (id: number, payload: Partial<CreateAgentPayload>): Promise<Agent> => {
    const res = await apiClient.put(`/agents/${id}`, payload)
    return res.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/agents/${id}`)
  },

  getSkills: async (id: number): Promise<AgentSkill[]> => {
    const res = await apiClient.get(`/agents/${id}/skills`)
    return res.data
  },

  uploadAvatar: async (id: number, file: File): Promise<void> => {
    const form = new FormData()
    form.append('file', file)
    await apiClient.put(`/agents/${id}/avatar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAvatar: async (id: number): Promise<void> => {
    await apiClient.delete(`/agents/${id}/avatar`)
  },
}
