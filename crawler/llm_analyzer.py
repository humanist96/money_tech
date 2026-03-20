"""LLM-based NLP analyzer using OpenAI GPT-4o-mini."""
from __future__ import annotations

import json
import os

from logger import logger

# Only import openai if available (graceful fallback)
try:
    from openai import OpenAI

    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

SYSTEM_PROMPT = """당신은 한국 재테크/투자 콘텐츠 분석 전문가입니다.
주어진 콘텐츠를 분석하여 다음 JSON 형식으로만 응답하세요:

{
  "assets": [
    {"name": "삼성전자", "code": "005930", "type": "stock", "sentiment": "positive"}
  ],
  "overall_sentiment": "positive|negative|neutral",
  "predictions": [
    {"asset_name": "삼성전자", "asset_code": "005930", "type": "buy|sell|hold", "reason": "근거 요약"}
  ],
  "key_points": ["핵심 포인트 1", "핵심 포인트 2"],
  "summary": "한줄 요약"
}

규칙:
- assets: 텍스트에서 언급된 모든 투자 자산 (주식, 코인, 부동산 지역)
  - type은 "stock", "coin", "real_estate" 중 하나
  - code: 주식은 종목코드(005930), 코인은 심볼(BTC), 부동산은 지역(서울/강남)
  - sentiment: 해당 자산에 대한 논조 (positive/negative/neutral)
- predictions: 명확한 매수/매도/보유 추천이 있는 경우만 포함
- summary: 50자 이내 핵심 요약
- 반드시 유효한 JSON만 응답"""


class LLMAnalyzer:
    """GPT-4o-mini based content analyzer."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None and HAS_OPENAI and OPENAI_API_KEY:
            self._client = OpenAI(api_key=OPENAI_API_KEY)
        return self._client

    @property
    def available(self) -> bool:
        return HAS_OPENAI and bool(OPENAI_API_KEY)

    def analyze(
        self, text: str, title: str = "", platform: str = "default"
    ) -> dict | None:
        """Analyze content using GPT-4o-mini.

        Returns parsed JSON dict or None if unavailable/error.
        Cost: ~$0.002 per call (150 input + 300 output tokens avg)
        """
        if not self.available:
            return None

        # Truncate long text to control costs (max ~2000 chars)
        truncated = text[:2000] if len(text) > 2000 else text

        user_content = (
            f"제목: {title}\n\n내용:\n{truncated}" if title else truncated
        )

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"},
            )

            result = json.loads(response.choices[0].message.content)
            logger.info(
                "  LLM analysis: %d assets, %d predictions",
                len(result.get("assets", [])),
                len(result.get("predictions", [])),
            )
            return result

        except Exception as e:
            logger.warning(
                "  LLM analysis failed, falling back to keywords: %s", e
            )
            return None
