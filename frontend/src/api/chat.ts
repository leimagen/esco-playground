import { apiClient } from './client'

export interface Thread {
  id: number
  title: string | null
  type: 'single' | 'group'
  agent_ids: number[]
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  thread_id: number
  agent_id: number | null
  role: 'user' | 'assistant' | 'system'
  content: string
  image_b64?: string | null
  created_at: string
  streaming?: boolean
}

export interface SendMessagePayload {
  content: string
  image_b64?: string | null
  agent_id?: number | null
}

export const chatApi = {
  listThreads: async (): Promise<Thread[]> => {
    const res = await apiClient.get('/threads')
    return res.data
  },

  createThread: async (payload: {
    title?: string
    type?: 'single' | 'group'
    agent_ids: number[]
  }): Promise<Thread> => {
    const res = await apiClient.post('/threads', payload)
    return res.data
  },

  getMessages: async (threadId: number): Promise<Message[]> => {
    const res = await apiClient.get(`/threads/${threadId}/messages`)
    return res.data
  },

  deleteThread: async (threadId: number): Promise<void> => {
    await apiClient.delete(`/threads/${threadId}`)
  },

  inviteAgent: async (threadId: number, agentId: number): Promise<void> => {
    await apiClient.post(`/threads/${threadId}/invite`, { agent_id: agentId })
  },

  removeAgent: async (threadId: number, agentId: number): Promise<void> => {
    await apiClient.delete(`/threads/${threadId}/agents/${agentId}`)
  },
}

export function createMessageStream(
  threadId: number,
  payload: SendMessagePayload,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  onToolCall?: (data: unknown) => void
): () => void {
  const url = `http://localhost:8000/api/threads/${threadId}/send`

  let aborted = false
  const controller = new AbortController()

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(`HTTP ${res.status}`)
        return
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw)
            if (event.type === 'token') onToken(event.data)
            else if (event.type === 'done') onDone()
            else if (event.type === 'error') onError(event.data)
            else if (event.type === 'tool_call') onToolCall?.(event.data)
          } catch {
            // non-JSON lines
          }
        }
      }
    })
    .catch((err) => {
      if (!aborted) onError(err.message)
    })

  return () => {
    aborted = true
    controller.abort()
  }
}
