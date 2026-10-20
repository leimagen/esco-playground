import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '../../stores/agentStore'
import { agentsApi, Agent, CreateAgentPayload, fetchInstalledModels, InstalledModel } from '../../api/agents'
import { AgentAvatar } from '../shared/AgentAvatar'
import { MemoryManager } from './MemoryManager'
import { Plus, Trash2, Edit2, Check, X, Brain, Camera, XCircle, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

const ACCENT_COLORS = [
  '#7c6fcd', '#3ddbd9', '#d4a847', '#c05c7e',
  '#5c9bd4', '#7dbd8a', '#bd7d5c', '#bd5cb5',
]

// Model families that keep a custom persona well in multi-agent chats
const ROLEPLAY_TAGS = ['dolphin', 'hermes', 'openhermes', 'nous', 'wizard']

function isRoleplayModel(name: string): boolean {
  const lower = name.toLowerCase()
  return ROLEPLAY_TAGS.some(t => lower.includes(t))
}

function AvatarUploader({ agent, onChanged }: { agent: Agent; onChanged: (a: Agent) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      await agentsApi.uploadAvatar(agent.id, file)
      onChanged({ ...agent, has_avatar: true, updated_at: Date.now().toString() })
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleRemove = async () => {
    setLoading(true)
    try {
      await agentsApi.deleteAvatar(agent.id)
      onChanged({ ...agent, has_avatar: false, updated_at: Date.now().toString() })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="relative">
        <AgentAvatar agent={agent} size={64} ring />
        {loading && (
          <div className="absolute inset-0 rounded-full bg-bg-base/60 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-base hover:bg-bg-elevated border border-border rounded-lg text-xs text-text-primary transition-colors"
        >
          <Camera size={13} />
          {agent.has_avatar ? 'Change photo' : 'Upload photo'}
        </button>
        {agent.has_avatar && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent-rose/10 text-xs text-text-secondary hover:text-accent-rose rounded-lg transition-colors"
          >
            <XCircle size={13} />
            Remove photo
          </button>
        )}
        <p className="text-xs text-text-secondary">JPG, PNG or WebP · max 5 MB</p>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}


function AgentForm({
  initial,
  agentId,
  onSave,
  onCancel,
}: {
  initial?: Partial<CreateAgentPayload>
  agentId?: number
  onSave: (payload: CreateAgentPayload) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [persona, setPersona] = useState(initial?.persona ?? '')
  const [model, setModel] = useState(initial?.model_id ?? '')
  const [color, setColor] = useState(initial?.color ?? ACCENT_COLORS[0])
  const [vision, setVision] = useState(initial?.vision ?? false)
  const [saving, setSaving] = useState(false)
  const [installedModels, setInstalledModels] = useState<InstalledModel[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const { agents, updateAgent } = useAgentStore()
  const liveAgent = agentId ? agents.find((a) => a.id === agentId) : undefined

  useEffect(() => {
    fetchInstalledModels()
      .then((models) => {
        setInstalledModels(models)
        // If current model not in list, default to first installed
        if (models.length > 0 && !model) {
          const preferred = models.find(m => isRoleplayModel(m.name)) ?? models[0]
          setModel(preferred.id)
        }
      })
      .finally(() => setLoadingModels(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), persona, model_id: model, color, vision })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {liveAgent && (
        <AvatarUploader
          agent={liveAgent}
          onChanged={(updated) => updateAgent(updated)}
        />
      )}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Agent Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Carlos"
          required
          className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-teal/50"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Model</label>
        {loadingModels ? (
          <div className="flex items-center gap-2 text-xs text-text-secondary py-2">
            <RefreshCw size={12} className="animate-spin" /> Loading installed models...
          </div>
        ) : installedModels.length === 0 ? (
          <p className="text-xs text-accent-rose py-2">Ollama not running or no models installed.</p>
        ) : (
          <>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                setVision(e.target.value.includes('llava'))
              }}
              className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-teal/50"
            >
              {installedModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}  ({m.size_gb}GB){isRoleplayModel(m.name) ? '  ✦' : ''}
                </option>
              ))}
            </select>
            {isRoleplayModel(model) ? (
              <p className="text-xs text-accent-teal mt-1.5">✦ Este modelo acepta identidades personalizadas.</p>
            ) : (
              <p className="text-xs text-accent-amber mt-1.5">
                ⚠ Algunos modelos (Llama, Qwen, Phi) tienden a salir del personaje e ignorar el nombre del agente.
                Usa un modelo marcado con ✦ para identidad completa.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Persona</label>
        <textarea
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          rows={4}
          className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-teal/50 resize-none"
        />
        <p className="text-xs text-text-secondary mt-1">
          Describe the agent's personality. Venezuelan Spanish is automatically applied.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Color</label>
        <div className="flex gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={clsx(
                'w-7 h-7 rounded-full border-2 transition-all',
                color === c ? 'border-white scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-accent-teal/10 hover:bg-accent-teal/20 border border-accent-teal/30 text-accent-teal rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
        >
          <Check size={14} />
          {saving ? 'Saving…' : 'Save Agent'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 hover:bg-bg-elevated border border-border text-text-secondary rounded-lg text-sm transition-colors"
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </form>
  )
}

export function SettingsPage() {
  const { agents, fetchAgents, addAgent, updateAgent, removeAgent } = useAgentStore()
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleCreate = async (payload: CreateAgentPayload) => {
    const agent = await agentsApi.create(payload)
    addAgent(agent)
    setShowNew(false)
  }

  const handleUpdate = async (id: number, payload: CreateAgentPayload) => {
    const agent = await agentsApi.update(id, payload)
    updateAgent(agent)
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this agent and all their memories?')) return
    await agentsApi.delete(id)
    removeAgent(id)
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-text-primary mb-1">Settings</h1>
      <p className="text-text-secondary text-sm mb-8">Configure agents, integrations, and platform options.</p>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">Agents</h2>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface hover:bg-bg-elevated border border-border text-text-secondary hover:text-text-primary rounded-lg text-xs transition-colors"
          >
            <Plus size={13} />
            New Agent
          </button>
        </div>

        {showNew && (
          <div className="mb-4 p-4 bg-bg-surface border border-border rounded-xl">
            <h3 className="text-sm font-medium text-text-primary mb-4">New Agent</h3>
            <AgentForm
              onSave={handleCreate}
              onCancel={() => setShowNew(false)}
            />
          </div>
        )}

        {agents.length === 0 && !showNew && (
          <div className="text-center py-8 text-text-secondary text-sm bg-bg-surface border border-border rounded-xl">
            No agents yet.{' '}
            <button onClick={() => setShowNew(true)} className="text-accent-teal hover:underline">
              Create your first agent
            </button>
          </div>
        )}

        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
              {editingId === agent.id ? (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-text-primary mb-4">Edit {agent.name}</h3>
                  <AgentForm
                    initial={agent}
                    agentId={agent.id}
                    onSave={(p) => handleUpdate(agent.id, p)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3">
                  <AgentAvatar agent={agent} size={36} ring />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-text-primary">{agent.name}</span>
                      {agent.vision && (
                        <span className="text-xs px-1.5 py-0.5 bg-accent-violet/20 text-accent-violet rounded">
                          Vision
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary truncate mt-0.5">{agent.model_id}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingId(agent.id)}
                      className="p-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="p-2 rounded-lg hover:bg-accent-rose/10 text-text-secondary hover:text-accent-rose transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={16} className="text-accent-violet" />
          <h2 className="text-base font-semibold text-text-primary">Agent Memories</h2>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Each agent builds its own memory of your conversations. You can inspect, add, or delete facts.
        </p>
        <MemoryManager agents={agents} />
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-text-primary mb-4">Integrations</h2>
        <div className="space-y-2">
          {[
            { label: 'Gmail', desc: 'Read & send emails via AI agents', phase: 'Phase 4' },
            { label: 'Slack Bot', desc: 'Access your platform remotely', phase: 'Phase 4' },
            { label: 'File Whitelist', desc: 'Specify folders agents can access', phase: 'Phase 1' },
          ].map(({ label, desc, phase }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 bg-bg-surface border border-border rounded-xl">
              <div>
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-secondary">{desc}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-bg-elevated text-text-secondary rounded">
                {phase}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
