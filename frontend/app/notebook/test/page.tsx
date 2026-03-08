import { Suspense } from 'react'
import TestClient from './test-client'

export const metadata = {
  title: 'NotebookLM API 테스트 - MoneyTech',
  description: 'Chrome 확장 프로그램 기능 테스트',
}

export default function TestPage() {
  return (
    <Suspense>
      <TestClient />
    </Suspense>
  )
}
