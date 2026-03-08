import { Suspense } from 'react'
import TestClient from './test-client'

export const metadata = {
  title: 'NotebookLM API 테스트 - MoneyTech',
}

export default function TestPage() {
  return (
    <Suspense>
      <TestClient />
    </Suspense>
  )
}
