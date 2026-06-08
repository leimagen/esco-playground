import { NavLink, useNavigate } from 'react-router-dom'
import { MessageSquare, Calendar, BookOpen, Settings, Plus, Trash2 } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useAgentStore } from '../../stores/agentStore'
import { useEffect } from 'react'
import { chatApi } from '../../api/chat'
import { clsx } from 'clsx'

const navItems = [
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/cookbook', icon: BookOpen, label: 'Cookbook' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { threads, setThreads, activeThreadId, setActiveThread, removeThread } = useChatStore()
  const { agents, fetchAgents } = useAgentStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchAgents()
    chatApi.listThreads().then(setThreads).catch(console.error)
  }, [])

  const handleNewChat = async () => {
    if (agents.length === 0) {
      navigate('/settings')
      return
    }
    const thread = await chatApi.createThread({
      type: 'single',
      agent_ids: [agents[0].id],
    })
    setActiveThread(thread.id)
    setThreads([thread, ...threads])
    navigate(`/chat/${thread.id}`)
  }

  const handleDeleteThread = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    await chatApi.deleteThread(id)
    removeThread(id)
    if (activeThreadId === id) navigate('/chat')
  }

  return (
    <aside className="w-56 flex flex-col bg-bg-surface border-r border-border shrink-0">
      <nav className="p-2 border-b border-border">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                isActive
                  ? 'bg-accent-teal/10 text-accent-teal'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 py-1.5 mb-1">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Chats
          </span>
          <button
            onClick={handleNewChat}
            className="p-1 rounded hover:bg-bg-elevated text-text-secondary hover:text-accent-teal transition-colors"
            title="New chat"
          >
            <Plus size={14} />
          </button>
        </div>

        {threads.length === 0 && (
          <p className="text-xs text-text-secondary px-2 py-4 text-center">
            No chats yet.{' '}
            <button onClick={handleNewChat} className="text-accent-teal hover:underline">
              Start one
            </button>
          </p>
        )}

        {threads.map((thread) => (
          <NavLink
            key={thread.id}
            to={`/chat/${thread.id}`}
            onClick={() => setActiveThread(thread.id)}
            className={({ isActive }) =>
              clsx(
                'group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                isActive
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )
            }
          >
            <span className="truncate flex-1">
              {thread.title ?? `Chat #${thread.id}`}
            </span>
            <button
              onClick={(e) => handleDeleteThread(e, thread.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-accent-rose transition-all"
            >
              <Trash2 size={12} />
            </button>
          </NavLink>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
          <span className="text-xs text-text-secondary">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} ready
          </span>
        </div>
      </div>
    </aside>
  )
}
