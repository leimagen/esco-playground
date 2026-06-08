import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useAgentStore } from '../../stores/agentStore'
import { chatApi, createMessageStream, Message } from '../../api/chat'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { ChatHeader } from './ChatHeader'

interface Props {
  threadId: number
}

export function ChatWindow({ threadId }: Props) {
  const {
    messages, setMessages, appendMessage, updateStreamingMessage,
    finalizeMessage, setStreaming, streaming, threads, setThreads,
  } = useChatStore()
  const { agents } = useAgentStore()
  const [error, setError] = useState<string | null>(null)
  const [activeAgentIds, setActiveAgentIds] = useState<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const cancelStreamRef = useRef<(() => void) | null>(null)

  const threadMessages = messages[threadId] ?? []
  const thread = threads.find((t) => t.id === threadId)

  const reloadThreadInfo = useCallback(async () => {
    const updated = await chatApi.listThreads()
    setThreads(updated)
    const t = updated.find((t) => t.id === threadId)
    if (t) setActiveAgentIds(t.agent_ids)
  }, [threadId])

  useEffect(() => {
    chatApi.getMessages(threadId).then((msgs) => setMessages(threadId, msgs)).catch((e) => setError(e.message))
    reloadThreadInfo()
  }, [threadId])

  useEffect(() => {
    if (thread) setActiveAgentIds(thread.agent_ids)
  }, [thread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const handleSend = useCallback(
    (content: string, imageB64?: string | null) => {
      if (streaming || (!content.trim() && !imageB64)) return

      const tempUserId = Date.now()
      const userMsg: Message = {
        id: tempUserId,
        thread_id: threadId,
        agent_id: null,
        role: 'user',
        content,
        image_b64: imageB64 ?? null,
        created_at: new Date().toISOString(),
      }
      appendMessage(threadId, userMsg)

      const tempAssistantId = tempUserId + 1
      const assistantMsg: Message = {
        id: tempAssistantId,
        thread_id: threadId,
        agent_id: null,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        streaming: true,
      }
      appendMessage(threadId, assistantMsg)
      setStreaming(true)
      setError(null)

      cancelStreamRef.current = createMessageStream(
        threadId,
        { content, image_b64: imageB64 },
        (token) => updateStreamingMessage(threadId, tempAssistantId, token),
        () => {
          finalizeMessage(threadId, tempAssistantId)
          setStreaming(false)
          chatApi.getMessages(threadId).then((msgs) => setMessages(threadId, msgs)).catch(() => {})
          reloadThreadInfo()
        },
        (err) => {
          setError(err)
          setStreaming(false)
          finalizeMessage(threadId, tempAssistantId)
        }
      )
    },
    [threadId, streaming, reloadThreadInfo]
  )

  const handleCancel = () => {
    cancelStreamRef.current?.()
    setStreaming(false)
  }

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]))
  const threadAgents = agents.filter((a) => activeAgentIds.includes(a.id))

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        threadId={threadId}
        activeAgentIds={activeAgentIds}
        agents={threadAgents}
        onAgentsChanged={reloadThreadInfo}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {threadMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-text-secondary text-sm">
              Say something to get started.
            </p>
            {threadAgents.length > 0 && (
              <p className="text-xs text-text-secondary/60">
                Tip: use <span className="text-accent-teal font-mono">@{threadAgents[0]?.name}</span> to address a specific agent
              </p>
            )}
          </div>
        )}
        {threadMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            agent={msg.agent_id ? agentMap[msg.agent_id] : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 py-2 bg-accent-rose/10 border-t border-accent-rose/20 text-accent-rose text-xs">
          Error: {error}
        </div>
      )}

      <MessageInput
        onSend={handleSend}
        onCancel={handleCancel}
        disabled={false}
        streaming={streaming}
        agents={threadAgents}
        allAgents={agents}
      />
    </div>
  )
}
