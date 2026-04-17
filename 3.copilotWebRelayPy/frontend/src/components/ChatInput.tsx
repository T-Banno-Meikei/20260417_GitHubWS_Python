import { KeyboardEvent, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled: boolean
}

function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="メッセージを入力... (Enter で送信、Shift+Enter で改行)"
        disabled={disabled}
        rows={3}
      />
      <button
        className="send-button"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="送信"
      >
        {disabled ? '送信中...' : '送信'}
      </button>
    </div>
  )
}

export default ChatInput
