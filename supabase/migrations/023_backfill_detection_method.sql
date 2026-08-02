-- ============================================================
-- 023: predictions.detection_method 백필 (G36)
-- ============================================================
-- detection_method는 계획 §3.7 감지 정밀도 감사의 **층화 키**다. 이 값이
-- 없으면 경로별(keyword/llm/report) precision을 나눌 수 없어 지표 자체가
-- 성립하지 않는다. 실측 2026-08-02: 34,507건 중 99.78%가 NULL.
--
-- 원인 두 가지:
--   1) 컬럼이 017에서 추가돼 그 이전 수집분은 값이 없다
--   2) report_crawler.py의 INSERT가 컬럼을 아예 누락했다 (코드에서 수정)
--
-- 백필 범위는 **확실한 것만**으로 한정한다. analyst_report 플랫폼의 예측은
-- 정의상 report 경로이므로 소급 가능하지만, 유튜브·블로그의 과거 예측이
-- keyword였는지 llm이었는지는 기록이 남아 있지 않다. 추측해서 채우면
-- 감사 표본이 오염되므로 NULL로 남긴다 — 앞으로 수집되는 분은
-- nlp_pipeline이 정확히 기록한다.
-- ============================================================

UPDATE predictions p
SET detection_method = 'report'
FROM videos v
WHERE v.id = p.video_id
  AND v.platform = 'analyst_report'
  AND p.detection_method IS NULL;
