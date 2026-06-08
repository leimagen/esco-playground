import { useState, useEffect } from 'react'
import { Trash2, Plus, Brain, ChevronDown, ChevronRight } from 'lucide-react'
import { Agent } from '../../api/agents'
import { AgentAvatar } from '../shared/AgentAvatar'
import { memoryApi, MemoryFact, AddMemoryPayload } from '../../api/memory'
import { clsx } from 'clsx'

interface Props {
  agents: Agent[]
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value > 0.8 ? 'text-accent-teal' : value > 0.6 ? 'text-accent-amber' : 'text-text-secondary'
  return <span className={clsx('text-xs font-mono', color)}>{pct}%</span>
}

function AddMemoryForm({ agentId, onAdded }: { agentId: number; onAdded: (f: MemoryFact) => void }) {
  const [subject, setSubject] = useState('el usuario')
  const [predicate, setPredicate] = useState('')
  const [object, setObject] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!predicate.trim() || !object.trim()) return
    setSaving(true)
    try {
      const fact = await memoryApi.add(agentId, { subject, predicate: predicate.trim(), object: object.trim() })
      onAdded(fact)
      setPredicate('')
      setObject('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-bg-base rounded-lg border border-border space-y-2">
      <p className="text-xs text-text-secondary font-medium mb-2">Add memory manually</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-teal/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Predicate</label>
          <input
            value={predicate}
            onChange={(e) => setPredicate(e.target.value)}
            placeholder="trabaja en / vive en / prefiere…"
            className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-secondary outline-none focus:border-accent-teal/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Value</label>
          <input
            value={object}
            onChange={(e) => setObject(e.target.value)}
            placeholder="Caracas / Python /…"
            className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-secondary outline-none focus:border-accent-teal/50"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving || !predicate.trim() || !object.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-teal/10 hover:bg-accent-teal/20 border border-accent-teal/30 text-accent-teal rounded text-xs font-medium transition-colors disabled:opacity-40"
      >
        <Plus size={12} />
        {saving ? 'Adding…' : 'Add fact'}
      </button>
    </form>
  )
}

function AgentMemorySection({ agent }: { agent: Agent }) {
  const [facts, setFacts] = useState<MemoryFact[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (expanded && facts.length === 0) {
      setLoading(true)
      memoryApi.list(agent.id).then(setFacts).finally(() => setLoading(false))
    }
  }, [expanded])

  const handleDelete = async (chromaId: string) => {
    await memoryApi.delete(agent.id, chromaId)
    setFacts((prev) => prev.filter((f) => f.chroma_id !== chromaId))
  }

  const handleAdded = (fact: MemoryFact) => {
    setFacts((prev) => [fact, ...prev])
    setShowAdd(false)
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated transition-colors text-left"
      >
        <AgentAvatar agent={agent} size={32} />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">{agent.name}</p>
          <p className="text-xs text-text-secondary">
            {expanded && !loading ? `${facts.length} memories` : 'Click to view memories'}
          </p>
        </div>
        <Brain size={14} className="text-text-secondary mr-1" />
        {expanded ? <ChevronDown size={14} className="text-text-secondary" /> : <ChevronRight size={14} className="text-text-secondary" />}
      </button>

      {expanded && (
        <div className="border-t border-border bg-bg-base">
          <div className="p-3 flex items-center justify-between border-b border-border">
            <span className="text-xs text-text-secondary">{facts.length} stored facts</span>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1 text-xs text-accent-teal hover:text-accent-teal/80 transition-colors"
            >
              <Plus size={12} />
              Add manually
            </button>
          </div>

          {showAdd && (
            <div className="p-3 border-b border-border">
              <AddMemoryForm agentId={agent.id} onAdded={handleAdded} />
            </div>
          )}

          {loading && (
            <div className="p-4 text-center text-xs text-text-secondary">Loading memories…</div>
          )}

          {!loading && facts.length === 0 && (
            <div className="p-4 text-center text-xs text-text-secondary">
              No memories yet. {agent.name} will start learning from conversations automatically.
            </div>
          )}

          {!loading && facts.map((fact) => (
            <div key={fact.chroma_id} className="group flex items-start justify-between px-4 py-2.5 hover:bg-bg-elevated/50 transition-colors border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm text-text-primary">
                  <span className="text-text-secondary">{fact.subject}</span>
                  {' '}
                  <span className="text-text-secondary">{fact.predicate}</span>
                  {' '}
                  <span className="font-medium">{fact.object}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ConfidenceBadge value={fact.confidence} />
                <button
                  onClick={() => handleDelete(fact.chroma_id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-accent-rose transition-all text-text-secondary"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MemoryManager({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-6">
        Create an agent first to manage memories.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <AgentMemorySection key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
