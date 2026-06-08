import { Calendar } from 'lucide-react'

export function CalendarPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border flex items-center justify-center">
        <Calendar size={28} className="text-accent-amber" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Calendar</h2>
        <p className="text-text-secondary text-sm">Coming in Phase 3 — events, reminders, and Slack notifications.</p>
      </div>
    </div>
  )
}
