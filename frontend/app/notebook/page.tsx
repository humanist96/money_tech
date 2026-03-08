import type { Metadata } from 'next'
import { Suspense } from 'react'
import NotebookClient from './notebook-client'

export const metadata: Metadata = {
  title: 'NotebookLM 리서치 - MoneyTech',
  description: 'NotebookLM 연계 투자 리서치 - 오디오 브리핑, Q&A, 퀴즈, 보고서',
}

export default function NotebookPage() {
  return (
    <Suspense>
      <NotebookClient />
    </Suspense>
  )
}
