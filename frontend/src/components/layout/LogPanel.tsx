import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export function LogPanel() {
  const { backendLogs, toggleLogs } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [backendLogs])

  return (
    <div className="h-40 bg-bg-base border-t border-border flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border">
        <span className="text-xs font-mono text-text-secondary">System Logs</span>
        <button
          onClick={toggleLogs}
          className="p-1 rounded hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs text-text-secondary leading-relaxed">
        {backendLogs.length === 0 && (
          <span className="text-text-secondary/50">Waiting for services...</span>
        )}
        {backendLogs.map((line, i) => (
          <div
            key={i}
            className={
              line.includes('error') || line.includes('Error')
                ? 'text-accent-rose'
                : line.includes('ready') || line.includes('Ready')
                ? 'text-accent-teal'
                : ''
            }
          >
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
