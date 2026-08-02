-- ============================================================
-- 024: 세션 사용자 API 사용량 (G15 레이트리밋 기반)
-- ============================================================
-- api_usage_log는 발급된 API 키(api_key_id)에 묶여 있어 로그인 세션으로
-- 호출되는 /api/search·/api/research를 셀 수 없다. 그 6개 라우트 중 4개가
-- OpenAI·YouTube·네이버 쿼터를 소모하는데 지금까지 무제한이었다.
--
-- 서버리스라 인메모리 카운터는 인스턴스마다 흩어져 무의미하므로 DB에
-- 기록한다. 한 행이 한 호출이며, 윈도 판정은 created_at 범위 카운트다.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_api_usage (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT        NOT NULL,
    route      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 레이트리밋 조회는 항상 (user, route, 최근 N분) 형태다.
CREATE INDEX IF NOT EXISTS idx_user_api_usage_window
    ON user_api_usage (user_id, route, created_at DESC);

-- 카운터는 짧은 윈도만 보므로 오래된 행은 가치가 없다. prune_log_tables가
-- 이미 도는 경로에 얹어 별도 크론 없이 정리한다.
CREATE OR REPLACE FUNCTION prune_log_tables()
RETURNS void AS $$
BEGIN
    DELETE FROM api_usage_log WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM search_cache  WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM user_api_usage WHERE created_at < NOW() - INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql;
