import { useCallback, useEffect, useRef, useState } from 'react'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

function getWsUrl(): string {
  const { hostname, protocol } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  // GitHub Codespaces: {codespace-name}-{port}.app.github.dev
  if (hostname.includes('.app.github.dev')) {
    const backendHost = hostname.replace(/-\d+\.app\.github\.dev$/, '-5000.app.github.dev')
    return `${wsProtocol}//${backendHost}`
  }
  return 'ws://localhost:5000'
}

const WS_URL = getWsUrl()

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState<string>('')
  const [isSending, setIsSending] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnectionStatus('connected')

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      setIsSending(false)
      // ストリーミング中に切断された場合、途中のコンテンツを確定
      setStreamingContent((prev) => {
        if (prev) {
          setMessages((msgs) => [...msgs, { role: 'assistant', content: prev }])
        }
        return ''
      })
    }

    ws.onerror = () => {
      setConnectionStatus('error')
      setIsSending(false)
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'delta') {
          setStreamingContent((prev) => prev + (data.content as string))
        } else if (data.type === 'done') {
          setStreamingContent((prev) => {
            if (prev) {
              setMessages((msgs) => [...msgs, { role: 'assistant', content: prev }])
            }
            return ''
          })
          setIsSending(false)
        } else if (data.type === 'error') {
          const errorMsg = (data.message as string) || 'エラーが発生しました'
          setStreamingContent('')
          setMessages((msgs) => [...msgs, { role: 'assistant', content: `⚠️ ${errorMsg}` }])
          setIsSending(false)
        }
      } catch {
        // JSON パース失敗は無視
      }
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim() || isSending) return

      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        connect()
        return
      }

      setMessages((msgs) => [...msgs, { role: 'user', content }])
      setIsSending(true)
      wsRef.current.send(JSON.stringify({ type: 'message', content }))
    },
    [isSending, connect],
  )

  const statusLabel: Record<ConnectionStatus, string> = {
    connecting: '接続中...',
    connected: '接続済み',
    disconnected: '未接続',
    error: '接続エラー',
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Copilot Chat</h1>
        <div className={`connection-status status-${connectionStatus}`}>
          <span className="status-dot" />
          {statusLabel[connectionStatus]}
        </div>
      </header>

      <main className="messages-container">
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} isStreaming={false} />
        ))}
        {streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming={true} />
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="input-footer">
        <ChatInput onSend={handleSend} disabled={isSending || connectionStatus !== 'connected'} />
        {connectionStatus !== 'connected' && (
          <button className="reconnect-btn" onClick={connect}>
            再接続
          </button>
        )}
      </footer>
    </div>
  )
}

export default App
