'use client'

import { useState, useRef, useEffect } from 'react'
import type { NotebookChatMessage } from '@/lib/types'

interface ChatPanelProps {
  messages: NotebookChatMessage[]
  loading: boolean
  onSend: (question: string) => void
}

export default function ChatPanel({ messages, loading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e8b8" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Q&A 소스 기반 질의응답
        </h3>
      </div>

      <div className="h-[350px] overflow-y-auto space-y-3 pr-2 bg-[#060e1a] rounded-lg p-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#556a8a" strokeWidth="1.5" className="mx-auto">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm text-[#556a8a]">소스 기반으로 질문하세요</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {['핵심 내용 요약해줘', '투자 전략은?', '리스크 요인은?'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); onSend(q) }}
                    className="text-[10px] px-2.5 py-1 bg-[#0a1628] border border-[#1a2744] rounded-full text-[#8899b4] hover:text-white hover:border-[#00e8b8]/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-[#00e8b8]/10 text-[#00e8b8] border border-[#00e8b8]/20'
                : 'bg-[#0a1628] text-[#c8d6e5] border border-[#1a2744]'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.references && msg.references.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#1a2744]">
                  <p className="text-[10px] text-[#556a8a] mb-1">참조:</p>
                  {msg.references.map((ref, j) => (
                    <p key={j} className="text-[10px] text-[#556a8a] truncate">- {ref.text}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="p-3 rounded-lg bg-[#0a1628] border border-[#1a2744] flex items-center gap-2">
              <Spinner /> <span className="text-xs text-[#556a8a]">응답 생성 중...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          className="bg-[#0a1628] border border-[#1a2744] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#556a8a] focus:outline-none focus:border-[#00e8b8]/50 transition-colors flex-1"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-[#1a2744] border border-[#00e8b8]/30 text-[#00e8b8] text-sm font-medium rounded-lg hover:bg-[#1a2744]/80 transition-colors disabled:opacity-40"
        >
          {loading ? <Spinner /> : '전송'}
        </button>
      </form>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
