-- ============================================================
-- 022: asset_dictionary.asset_code 유일성 강제
-- ============================================================
-- 평가 경로가 `LEFT JOIN asset_dictionary ad ON ad.asset_code = ma.asset_code`
-- 로 벤치마크(market)를 가져온다. asset_code가 중복되면 이 조인이 평가 행을
-- 배수로 부풀려 적중률 분모를 조용히 오염시킨다. 지금까지는 (asset_name,
-- asset_type)에만 유일 인덱스가 있어 코드 중복을 막는 장치가 없었다.
--
-- backfill_market이 사전에 없는 종목까지 등재하도록 확대되면서(G40) 삽입
-- 경로가 늘어난 만큼, 제약으로 고정한다.
-- ============================================================

-- 기존 데이터에 중복이 있으면 인덱스 생성이 실패하므로 사전 정리.
-- 같은 코드가 여러 행에 있으면 market을 아는 행을, 그것도 같으면 먼저
-- 만들어진 행을 남긴다.
DELETE FROM asset_dictionary a
USING asset_dictionary b
WHERE a.asset_code = b.asset_code
  AND a.id <> b.id
  AND (
    (a.market IS NULL AND b.market IS NOT NULL)
    OR (
      (a.market IS NULL) = (b.market IS NULL)
      AND a.created_at > b.created_at
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_dict_code_unique
  ON asset_dictionary (asset_code);

-- 유일 인덱스가 기존 비유일 인덱스를 완전히 대체한다.
DROP INDEX IF EXISTS idx_asset_dict_code;
