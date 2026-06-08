import { apiClient } from './client'

export interface MemoryFact {
  chroma_id: string
  subject: string
  predicate: string
  object: string
  confidence: number
  text: string
}

export interface AddMemoryPayload {
  subject: string
  predicate: string
  object: string
  confidence?: number
}

export const memoryApi = {
  list: async (agentId: number): Promise<MemoryFact[]> => {
    const res = await apiClient.get(`/memory/${agentId}`)
    return res.data
  },

  add: async (agentId: number, payload: AddMemoryPayload): Promise<MemoryFact> => {
    const res = await apiClient.post(`/memory/${agentId}`, payload)
    return res.data
  },

  delete: async (agentId: number, chromaId: string): Promise<void> => {
    await apiClient.delete(`/memory/${agentId}/${encodeURIComponent(chromaId)}`)
  },
}
