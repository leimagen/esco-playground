import { useState } from 'react'
import { Agent } from '../../api/agents'

interface Props {
  agent: Agent
  size?: number       // px, default 32
  className?: string
  ring?: boolean      // show colored ring
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function AgentAvatar({ agent, size = 32, className = '', ring = false }: Props) {
  const [imgError, setImgError] = useState(false)
  const fontSize = Math.round(size * 0.38)

  const showPhoto = agent.has_avatar && !imgError

  const ringStyle = ring
    ? { boxShadow: `0 0 0 2px ${agent.color}66` }
    : {}

  if (showPhoto) {
    return (
      <img
        src={`http://localhost:8000/api/agents/${agent.id}/avatar?t=${agent.updated_at ?? ''}`}
        alt={agent.name}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size, ...ringStyle }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: agent.color + '33',
        color: agent.color,
        fontSize,
        ...ringStyle,
      }}
    >
      {initials(agent.name)}
    </div>
  )
}
