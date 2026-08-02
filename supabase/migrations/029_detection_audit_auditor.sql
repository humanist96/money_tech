-- ============================================================
-- 029: 감사 라벨의 출처 구분 (detection_audit.auditor)
-- ============================================================
-- 계획 §3.7은 "월 1회 경로별 층화 50건 **수동 감사**"를 규정한다. 판정을
-- 사람이 한다는 것이 이 지표의 전제다 — 감지도 LLM이 하고 검증도 LLM이
-- 하면 같은 편향을 공유해 precision이 스스로를 보증하게 된다.
--
-- 그럼에도 LLM 보조 라벨은 쓸모가 있다: 표본이 0행인 상태보다 참고 수치가
-- 있는 편이 낫고, 사람이 재감사할 때 출발점이 된다. 문제는 **둘을 구분
-- 없이 같은 테이블에 넣는 것**이다. 그러면 precision이 무엇에 근거한
-- 숫자인지 사후에 알 수 없다.
--
-- auditor를 남기고, 제품 동작을 바꾸는 노출 보류 게이트는 auditor='human'
-- 라벨에만 반응하도록 한다(evaluator_v2). LLM 라벨은 리포트에 별도 행으로
-- 표시될 뿐 리더보드를 건드리지 않는다.
-- ============================================================

ALTER TABLE detection_audit
    ADD COLUMN IF NOT EXISTS auditor TEXT NOT NULL DEFAULT 'human';

COMMENT ON COLUMN detection_audit.auditor IS
    'human = 수동 감사(계획 §3.7 규정, 노출 보류 게이트의 유일한 근거) / '
    'llm-assisted = 모델 보조 라벨(참고용, 게이트 미반영)';

CREATE INDEX IF NOT EXISTS idx_detection_audit_auditor
    ON detection_audit (auditor, detection_method);
