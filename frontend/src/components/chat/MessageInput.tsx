import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { Send, Square, Paperclip, X } from 'lucide-react'
import { Agent } from '../../api/agents'
import { AgentAvatar } from '../shared/AgentAvatar'
import { clsx } from 'clsx'

interface Props {
  onSend: (content: string, imageB64?: string | null) => void
  onCancel: () => void
  disabled: boolean
  streaming: boolean
  agents: Agent[]
  allAgents: Agent[]
}

interface MentionState {
  active: boolean
  query: string
  startIndex: number
}

export function MessageInput({ onSend, onCancel, disabled, streaming, agents, allAgents }: Props) {
  const [text, setText] = useState('')
  const [imageB64, setImageB64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [mention, setMention] = useState<MentionState>({ active: false, query: '', startIndex: -1 })
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mentionCandidates = mention.active
    ? allAgents.filter((a) => a.name.toLowerCase().startsWith(mention.query.toLowerCase()))
    : []

  useEffect(() => {
    setMentionIndex(0)
  }, [mention.query])

  const handleTextChange = (value: string) => {
    setText(value)

    const cursor = textareaRef.current?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const atMatch = before.match(/@(\w*)$/)

    if (atMatch) {
      setMention({ active: true, query: atMatch[1], startIndex: before.lastIndexOf('@') })
    } else {
      setMention({ active: false, query: '', startIndex: -1 })
    }
  }

  const applyMention = (agent: Agent) => {
    const cursor = textareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, mention.startIndex)
    const after = text.slice(cursor)
    const newText = `${before}@${agent.name} ${after}`
    setText(newText)
    setMention({ active: false, query: '', startIndex: -1 })
    setTimeout(() => {
      const pos = mention.startIndex + agent.name.length + 2
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed && !imageB64) return
    onSend(trimmed, imageB64)
    setText('')
    setImageB64(null)
    setImagePreview(null)
    setMention({ active: false, query: '', startIndex: -1 })
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.active && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionCandidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length)
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && mention.active)) {
        e.preventDefault()
        applyMention(mentionCandidates[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        setMention({ active: false, query: '', startIndex: -1 })
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!streaming) handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImageB64(result.split(',')[1])
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = (ev) => {
          const result = ev.target?.result as string
          setImageB64(result.split(',')[1])
          setImagePreview(result)
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }

  const renderText = () => {
    if (!text) return null
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1)
        const agent = allAgents.find((a) => a.name.toLowerCase() === name.toLowerCase())
        if (agent) {
          return (
            <span key={i} style={{ color: agent.color }} className="font-medium">
              {part}
            </span>
          )
        }
      }
      return part
    })
  }

  return (
    <div className="p-4 border-t border-border">
      {imagePreview && (
        <div className="relative inline-block mb-2">
          <img src={imagePreview} alt="preview" className="h-20 rounded-lg border border-border object-contain" />
          <button
            onClick={() => { setImageB64(null); setImagePreview(null) }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bg-elevated border border-border rounded-full flex items-center justify-center hover:bg-accent-rose/20 hover:text-accent-rose transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      )}

      <div className="relative">
        {mention.active && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden z-20">
            <div className="px-3 py-1.5 border-b border-border">
              <span className="text-xs text-text-secondary">Mention an agent</span>
            </div>
            {mentionCandidates.map((agent, i) => (
              <button
                key={agent.id}
                onMouseDown={(e) => { e.preventDefault(); applyMention(agent) }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                  i === mentionIndex ? 'bg-bg-base' : 'hover:bg-bg-base'
                )}
              >
                <AgentAvatar agent={agent} size={24} />
                <div>
                  <span className="text-sm text-text-primary font-medium">{agent.name}</span>
                  <span className="text-xs text-text-secondary ml-2">{agent.model_id.split(':')[0]}</span>
                </div>
                {i === mentionIndex && <span className="ml-auto text-xs text-text-secondary/50">Tab</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-accent-teal/50 transition-colors">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-text-secondary hover:text-accent-teal transition-colors shrink-0 mb-0.5"
            title="Attach image"
          >
            <Paperclip size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={agents.length > 0 ? `Message… (type @ to mention an agent)` : 'Message…'}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-text-primary placeholder-text-secondary outline-none leading-relaxed max-h-36 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />

          {streaming ? (
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose transition-colors shrink-0 mb-0.5"
              title="Stop"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim() && !imageB64}
              className="p-2 rounded-lg bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal transition-colors shrink-0 mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Send (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
