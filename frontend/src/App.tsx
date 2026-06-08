import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { ChatPage } from './components/chat/ChatPage'
import { CalendarPage } from './components/calendar/CalendarPage'
import { CookbookPage } from './components/cookbook/CookbookPage'
import { SettingsPage } from './components/settings/SettingsPage'
import { LogPanel } from './components/layout/LogPanel'
import { useAppStore } from './stores/appStore'

export default function App() {
  const showLogs = useAppStore((s) => s.showLogs)

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:threadId" element={<ChatPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/cookbook" element={<CookbookPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
        {showLogs && <LogPanel />}
      </div>
    </BrowserRouter>
  )
}
