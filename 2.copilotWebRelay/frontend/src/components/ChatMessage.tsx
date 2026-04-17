import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
}

function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  return (
    <div className={`message message-${role}`}>
      <div className="message-label">{role === 'user' ? 'あなた' : 'AI'}</div>
      <div className="message-bubble">
        {role === 'user' ? (
          <span className="message-text">{content}</span>
        ) : (
          <div className="message-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {isStreaming && <span className="streaming-cursor" />}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatMessage
