import { Agent } from '../../api/agents'
import { Message } from '../../api/chat'
import { AgentAvatar } from '../shared/AgentAvatar'

interface Props {
  message: Message
  agent?: Agent
}

export function MessageBubble({ message, agent }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-2 fade-in-up">
        <div className="max-w-[70%]">
          {message.image_b64 && (
            <img
              src={`data:image/png;base64,${message.image_b64}`}
              alt="attachment"
              className="rounded-lg mb-1 max-h-48 object-contain border border-border"
            />
          )}
          <div className="selectable bg-accent-teal/10 border border-accent-teal/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-text-primary">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  const color = agent?.color ?? '#7c6fcd'

  return (
    <div className="flex gap-3 mb-2 fade-in-up">
      <div className="mt-0.5 shrink-0">
        {agent ? (
          <AgentAvatar agent={agent} size={28} />
        ) : (
          <div className="w-7 h-7 rounded-full bg-bg-elevated" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {agent && (
          <div className="text-xs font-medium mb-1" style={{ color }}>
            {agent.name}
          </div>
        )}
        <div className="selectable bg-bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-text-primary leading-relaxed">
          {message.content || (message.streaming ? '' : '…')}
          {message.streaming && <span className="cursor-blink" />}
        </div>
      </div>
    </div>
  )
}
