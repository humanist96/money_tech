-- ============================================================
-- 026: v1 지표를 생산하는 MV 폐기 (G31)
-- ============================================================
-- mv_hit_rate_leaderboard는 direction_score 평균으로 적중률을 낸다. 그
-- 컬럼은 evaluation_version=2 파이프라인이 더는 쓰지 않아 값이 구 파이프라인
-- 시점에 얼어붙어 있고, HAVING count(*) >= 1이라 예측 1건짜리 채널도 순위에
-- 오른다 — 계획 §3.5가 없애려던 승자의 저주 그 자체다.
--
-- 프론트 참조는 0건이다(리더보드는 channel_stats를 읽는다). 그럼에도 매
-- evaluate 실행마다 refresh돼, 아무도 보지 않는 v1 수치를 계속 만들어 왔다.
-- 남겨두면 언젠가 누군가 "이미 있는 리더보드 뷰"라며 다시 붙인다.
--
-- mv_asset_consensus·mv_market_sentiment는 실사용 중이므로 유지한다.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_hit_rate_leaderboard;

-- refresh 함수에서도 제거 — 존재하지 않는 뷰를 갱신하려다 함수 전체가
-- 실패하면 나머지 두 MV까지 갱신이 멈춘다.
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_asset_consensus;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_sentiment;
END;
$$ LANGUAGE plpgsql;
