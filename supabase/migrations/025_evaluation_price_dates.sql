-- ============================================================
-- 025: 평가에 실제로 쓰인 가격의 날짜 기록 (G42)
-- ============================================================
-- 평가는 t0(발행일)와 t0+h를 요구하지만, 그 날짜에 시세가 없으면
-- MAX_DATE_SLACK_DAYS(3일) 이내의 직전 거래일 종가를 빌린다. 어느 날짜를
-- 빌렸는지는 지금까지 어디에도 남지 않았다.
--
-- 왜 문제인가: 이 표본 구간에서 KOSPI는 하루에 -17.2%, +17.9%를 오갔다.
-- 자산과 벤치마크가 서로 다른 세션을 잡으면 초과수익이 통째로 왜곡되는데,
-- 채택일이 없으면 그 왜곡이 얼마나 있었는지 사후에 셀 수가 없다.
-- 선행 사이클(§14.4 가설 ③)이 "구조적 가능성은 있으나 정량 미검증"으로
-- 남긴 것이 정확히 이 이유다.
--
-- 정렬 자체는 이미 고쳤다(자산 채택일로 벤치마크도 조회). 이 마이그레이션은
-- **고친 것이 실제로 맞는지 측정할 수 있게** 만든다.
-- ============================================================

ALTER TABLE prediction_evaluations
    ADD COLUMN IF NOT EXISTS price_t0_date     DATE,
    ADD COLUMN IF NOT EXISTS price_th_date     DATE,
    ADD COLUMN IF NOT EXISTS benchmark_t0_date DATE,
    ADD COLUMN IF NOT EXISTS benchmark_th_date DATE;

COMMENT ON COLUMN prediction_evaluations.price_t0_date IS
    '자산 t0 가격의 실제 거래일. predicted_at과 다르면 슬랙이 걸린 것';
COMMENT ON COLUMN prediction_evaluations.benchmark_t0_date IS
    '벤치마크 t0 가격의 실제 거래일. price_t0_date와 달라야 할 이유는 없다';

-- 기존 행은 NULL로 남는다 — 어느 날짜를 썼는지 복원할 방법이 없고,
-- 추정해 채우면 편향 측정 자체가 오염된다. 다음 평가부터 채워진다.
