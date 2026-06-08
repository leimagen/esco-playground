import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatStore } from '../../stores/chatStore'
import { useAgentStore } from '../../stores/agentStore'
import { ChatWindow } from './ChatWindow'
import { MessageSquare, Plus } from 'lucide-react'
import { chatApi } from '../../api/chat'

export function ChatPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const navigate = useNavigate()
  const { threads, setThreads, setActiveThread, activeThreadId } = useChatStore()
  const { agents, fetchAgents } = useAgentStore()

  useEffect(() => {
    if (threadId) {
      setActiveThread(Number(threadId))
    }
  }, [threadId])

  useEffect(() => {
    fetchAgents()
  }, [])

  const handleNewChat = async () => {
    if (agents.length === 0) return
    const thread = await chatApi.createThread({
      type: 'single',
      agent_ids: [agents[0].id],
    })
    setActiveThread(thread.id)
    setThreads([thread, ...threads])
    navigate(`/chat/${thread.id}`)
  }

  if (!activeThreadId && !threadId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border flex items-center justify-center">
          <MessageSquare size={28} className="text-accent-teal" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Esco Playground</h2>
          <p className="text-text-secondary text-sm max-w-sm">
            Your local AI agent platform. Start a conversation or configure your agents in Settings.
          </p>
        </div>
        <button
          onClick={handleNewChat}
          disabled={agents.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-teal/10 hover:bg-accent-teal/20 border border-accent-teal/30 text-accent-teal rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {agents.length === 0 ? 'Add an agent first in Settings' : 'Start a chat'}
        </button>
      </div>
    )
  }

  return <ChatWindow threadId={Number(threadId ?? activeThreadId)} />
}
