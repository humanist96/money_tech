/**
 * 등락 원인 카드/페이지의 제목. 대시보드와 /movers 두 곳이 같은 날짜에
 * 다른 라벨을 말하지 않도록 규칙을 한 곳에 둔다.
 *
 * 날짜 문자열끼리 비교하는 이유: `new Date("2026-07-30")`은 UTC 자정으로
 * 파싱되므로 `Date.now()`와의 차를 반올림하면 KST 저녁에 하루가 튄다.
 * 거래일은 KST 달력일이므로 KST 달력일끼리 맞대는 것이 정확하다.
 */
function kstDateString(offsetDays = 0): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  return new Date(Date.now() + KST_OFFSET_MS - offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

export function moversHeading(tradeDate: string | null, fallback = '등락 원인'): string {
  if (!tradeDate) return fallback
  if (tradeDate === kstDateString(0)) return '오늘 왜 움직였나'
  if (tradeDate === kstDateString(1)) return '어제 왜 움직였나'
  return `${tradeDate.slice(5).replace('-', '/')} 왜 움직였나`
}
