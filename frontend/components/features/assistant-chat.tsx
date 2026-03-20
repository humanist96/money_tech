"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED_QUESTIONS = [
  "비트코인 컨센서스는?",
  "적중률 1위 채널은?",
  "최근 급등 종목은?",
  "테슬라 전망 어때?",
  "시장 분위기 알려줘",
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-th-accent/60 animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-th-accent/60 animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-th-accent/60 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-th-accent/10 text-th-accent flex items-center justify-center mr-2 mt-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.09 3.26L16.36 6l-2.63 2.09L14.82 12 12 9.91 9.18 12l1.09-3.91L7.64 6l3.27-.74z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-th-accent text-white rounded-br-md"
            : "bg-th-card border border-th-border text-th-primary rounded-bl-md"
        }`}
      >
        {formatContent(message.content)}
      </div>
    </div>
  )
}

function formatContent(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    const boldReplaced = line.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold">$1</strong>'
    )
    return (
      <span key={i}>
        {i > 0 && <br />}
        <span dangerouslySetInnerHTML={{ __html: boldReplaced }} />
      </span>
    )
  })
}

export default function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = { role: "user", content: trimmed }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const history = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader")

      const decoder = new TextDecoder()
      let accumulated = ""

      setMessages(prev => [...prev, { role: "assistant", content: "" }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const current = accumulated
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: current }
          return updated
        })
      }

      if (!accumulated) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "assistant",
            content: "응답을 생성할 수 없었습니다. 다시 시도해주세요.",
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => [
        ...prev,
        ...(prev[prev.length - 1]?.role === "assistant" ? [] : []),
        {
          role: "assistant" as const,
          content: "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-th-card/30 border border-th-border backdrop-blur-sm p-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-th-accent/10 text-th-accent flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M12 7v2" />
                <path d="M12 13h.01" />
              </svg>
            </div>
            <p className="text-th-secondary text-sm mb-6">
              크리에이터 예측 데이터를 기반으로 답변합니다
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="px-3.5 py-2 text-xs rounded-full border border-th-border bg-th-card text-th-secondary hover:text-th-accent hover:border-th-accent/40 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-lg bg-th-accent/10 text-th-accent flex items-center justify-center mr-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l1.09 3.26L16.36 6l-2.63 2.09L14.82 12 12 9.91 9.18 12l1.09-3.91L7.64 6l3.27-.74z" />
              </svg>
            </div>
            <div className="bg-th-card border border-th-border rounded-2xl rounded-bl-md">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions below chat when not empty */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-1.5 mt-2 px-1">
          {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="px-2.5 py-1 text-[11px] rounded-full border border-th-border text-th-dim hover:text-th-accent hover:border-th-accent/40 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="mt-3 flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="종목, 채널, 시장에 대해 질문하세요..."
            disabled={isLoading}
            rows={1}
            className="w-full resize-none rounded-xl border border-th-border bg-th-card px-4 py-3 text-sm text-th-primary placeholder:text-th-dim focus:outline-none focus:border-th-accent/50 focus:ring-1 focus:ring-th-accent/20 transition-colors disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = "auto"
              target.style.height = Math.min(target.scrollHeight, 120) + "px"
            }}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-th-accent text-white flex items-center justify-center hover:bg-th-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
