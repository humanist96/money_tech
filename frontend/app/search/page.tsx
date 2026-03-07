import SearchClient from './search-client'

export const metadata = {
  title: 'MoneyTech - AI 검색 분석',
  description: 'YouTube 키워드 검색 기반 AI 투자 인사이트',
}

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI 검색 분석</h1>
        <p className="mt-1 text-sm text-[#8899b4]">
          키워드를 입력하면 YouTube에서 관련 영상을 찾고 AI가 분석합니다
        </p>
      </div>
      <SearchClient />
    </div>
  )
}
