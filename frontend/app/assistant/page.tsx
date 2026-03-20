import AssistantChat from '@/components/features/assistant-chat'

export const metadata = {
  title: 'MoneyTech - AI 투자 어시스턴트',
  description: '종목, 채널, 시장 트렌드에 대해 AI에게 물어보세요',
}

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-th-accent/10 text-th-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.09 3.26L16.36 6l-2.63 2.09L14.82 12 12 9.91 9.18 12l1.09-3.91L7.64 6l3.27-.74z" />
            <path d="M2 12l1.09 3.26L6.36 16l-2.63 2.09L4.82 22 2 19.91-.18 22l1.09-3.91L-1.72 16l3.27-.74z" opacity="0.5" />
            <path d="M22 12l1.09 3.26 3.27.74-2.63 2.09L24.82 22 22 19.91 19.18 22l1.09-3.91-2.63-2.09 3.27-.74z" opacity="0.5" />
          </svg>
        </div>
        <div>
          <h1
            className="text-2xl font-bold text-th-primary"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            AI 투자 어시스턴트
          </h1>
          <p className="mt-0.5 text-sm text-th-muted">
            종목, 채널, 시장 트렌드에 대해 물어보세요
          </p>
        </div>
      </div>
      <AssistantChat />
    </div>
  )
}
