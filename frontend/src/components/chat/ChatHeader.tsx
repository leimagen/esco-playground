import { useState } from 'react'
import { UserPlus, X, ChevronDown } from 'lucide-react'
import { Agent } from '../../api/agents'
import { AgentAvatar } from '../shared/AgentAvatar'
import { chatApi } from '../../api/chat'
import { useAgentStore } from '../../stores/agentStore'
import { useChatStore } from '../../stores/chatStore'
import { clsx } from 'clsx'

interface Props {
  threadId: number
  activeAgentIds: number[]
  agents: Agent[]
  onAgentsChanged: () => void
}

export function ChatHeader({ threadId, activeAgentIds, agents, onAgentsChanged }: Props) {
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState<number | null>(null)
  const allAgents = useAgentStore((s) => s.agents)

  const activeAgents = agents.filter((a) => activeAgentIds.includes(a.id))
  const availableToInvite = allAgents.filter((a) => !activeAgentIds.includes(a.id))

  const handleInvite = async (agentId: number) => {
    setInviting(agentId)
    try {
      await chatApi.inviteAgent(threadId, agentId)
      onAgentsChanged()
      setShowInvite(false)
    } finally {
      setInviting(null)
    }
  }

  const handleRemove = async (agentId: number) => {
    if (activeAgentIds.length <= 1) return
    await chatApi.removeAgent(threadId, agentId)
    onAgentsChanged()
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-surface shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        {activeAgents.map((agent) => (
          <div
            key={agent.id}
            className="group flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-bg-elevated rounded-full text-xs"
          >
            <AgentAvatar agent={agent} size={20} />
            <span className="text-text-primary font-medium">{agent.name}</span>
            <span className="text-text-secondary">·</span>
            <span className="text-text-secondary">{agent.model_id.split(':')[0]}</span>
            {activeAgentIds.length > 1 && (
              <button
                onClick={() => handleRemove(agent.id)}
                className="ml-0.5 opacity-0 group-hover:opacity-100 text-text-secondary hover:text-accent-rose transition-all"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowInvite((v) => !v)}
          disabled={availableToInvite.length === 0}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            availableToInvite.length === 0
              ? 'opacity-30 cursor-not-allowed text-text-secondary'
              : 'bg-bg-elevated hover:bg-border text-text-secondary hover:text-text-primary'
          )}
          title={availableToInvite.length === 0 ? 'No more agents to invite' : 'Invite agent'}
        >
          <UserPlus size={13} />
          Invite
          <ChevronDown size={11} className={clsx('transition-transform', showInvite && 'rotate-180')} />
        </button>

        {showInvite && availableToInvite.length > 0 && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-bg-elevated border border-border rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-xs text-text-secondary font-medium">Add to this chat</span>
            </div>
            {availableToInvite.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleInvite(agent.id)}
                disabled={inviting === agent.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-base transition-colors text-left"
              >
                <AgentAvatar agent={agent} size={28} />
                <div>
                  <p className="text-sm text-text-primary font-medium">{agent.name}</p>
                  <p className="text-xs text-text-secondary">{agent.model_id.split(':')[0]}</p>
                </div>
                {inviting === agent.id && (
                  <div className="ml-auto w-3 h-3 border border-accent-teal border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            ))}
            <div className="px-3 py-2 border-t border-border">
              <p className="text-xs text-text-secondary">
                Tip: type <span className="text-accent-teal font-mono">@AgentName</span> to mention directly
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
