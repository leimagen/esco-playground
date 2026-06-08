import { Minus, Square, X, Terminal } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export function TitleBar() {
  const { showLogs, toggleLogs, backendReady } = useAppStore()
  const api = (window as any).escoAPI

  return (
    <div className="flex items-center justify-between h-10 px-4 bg-bg-surface border-b border-border drag-region select-none shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-2 h-2 rounded-full bg-accent-teal" />
        <span className="text-sm font-semibold text-text-primary tracking-wide">
          Esco Playground
        </span>
        <span className="text-xs text-text-secondary ml-1">v0.1</span>
      </div>

      <div className="flex items-center gap-1 no-drag">
        {!backendReady && (
          <span className="text-xs text-accent-amber mr-2 animate-pulse">
            Starting services...
          </span>
        )}

        <button
          onClick={toggleLogs}
          className={`p-1.5 rounded hover:bg-bg-elevated transition-colors ${
            showLogs ? 'text-accent-teal' : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Toggle logs"
        >
          <Terminal size={14} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => api?.minimize()}
          className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => api?.maximize()}
          className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => api?.close()}
          className="p-1.5 rounded hover:bg-accent-rose/20 text-text-secondary hover:text-accent-rose transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
