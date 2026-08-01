"""Turns numbered evidence into a readable explanation of a price move.

A model asked "why did this stock move?" will always produce a confident story,
including when the evidence supports none. Four guards keep the output tied to
what was actually supplied:

  1. Every factor must cite evidence numbers; citations outside the supplied
     set are dropped.
  2. A claim with no surviving citation is downgraded to "unexplained".
  3. Confidence is recomputed server-side from evidence types, not taken from
     the model.
  4. A broad index move is injected as evidence by code before the model runs,
     so it cannot attribute a market-wide day to company news.
"""
from __future__ import annotations

import json
import os
from datetime import date

from logger import logger

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

MODEL = "gpt-4o-mini"

CAUSE_TYPES = {
    "earnings", "contract", "capital_change", "supply_demand",
    "news_theme", "market_wide", "creator_driven", "unexplained",
}

SYSTEM_PROMPT = """당신은 한국 주식시장 데일리 리포트 작성자입니다.
주어진 [근거] 목록만 사용해 종목의 등락 원인을 설명합니다.

반드시 지킬 규칙:
1. 모든 factor는 evidence_refs에 인용한 근거 번호를 1개 이상 포함해야 합니다.
2. 제공된 근거로 설명할 수 없으면 원인을 지어내지 말고 cause_type을
   "unexplained"로 하고 "확인된 공개 요인이 없습니다"라고 쓰세요.
3. 매수/매도 권유 표현을 쓰지 마세요. 사실 서술과 인용만 허용됩니다.
4. 추측을 단정으로 쓰지 마세요.

아래 JSON 형식으로만 응답하세요:
{
  "headline": "20자 이내 원인 한줄",
  "cause_type": "earnings|contract|capital_change|supply_demand|news_theme|market_wide|creator_driven|unexplained",
  "summary": "3문장 이내 원인 요약. 초보자도 이해할 수 있는 언어.",
  "factors": [
    {"type": "disclosure|flow|news|market|creator", "description": "...", "evidence_refs": [1, 3]}
  ],
  "creator_context": "크리에이터 예측과의 관계 1-2문장. 관련 근거가 없으면 null",
  "confidence": "high|medium|low"
}"""


class MoversAnalyzer:
    def __init__(self):
        api_key = os.environ.get("OPENAI_API_KEY", "")
        self.available = HAS_OPENAI and bool(api_key)
        self.client = OpenAI(api_key=api_key) if self.available else None
        if not self.available:
            logger.warning("OPENAI_API_KEY not set — movers fall back to a rule-based summary")

    def analyze(self, candidate, evidence: list[dict], trade_date: date,
                index_moves: dict[str, float]) -> dict:
        if not evidence:
            return _unexplained(candidate, "no_evidence")
        if not self.available:
            return _rule_based(candidate, evidence)

        prompt = _build_prompt(candidate, evidence, trade_date, index_moves)
        try:
            response = self.client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=700,
                response_format={"type": "json_object"},
            )
            raw = json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.warning("Movers LLM call failed for %s: %s", candidate.stock_code, e)
            return _rule_based(candidate, evidence)

        return _validate(raw, evidence, candidate)


def _build_prompt(candidate, evidence: list[dict], trade_date: date,
                  index_moves: dict[str, float]) -> str:
    lines = [
        f"종목: {candidate.stock_name}({candidate.stock_code}, {candidate.market})",
        f"{trade_date.isoformat()} 등락률 {candidate.change_pct:+.2f}%, "
        f"거래대금 전일比 {candidate.value_ratio:.1f}배",
        f"당일 시장: KOSPI {index_moves.get('KOSPI', 0):+.2f}%, "
        f"KOSDAQ {index_moves.get('KOSDAQ', 0):+.2f}%",
        "",
    ]
    for item in evidence:
        date_part = f", {item['source_date']}" if item.get("source_date") else ""
        lines.append(f"[근거 {item['n']}] ({item['type']}{date_part}) {item['summary']}")
    return "\n".join(lines)


def _validate(raw: dict, evidence: list[dict], candidate) -> dict:
    """Keep only claims traceable to supplied evidence."""
    valid_refs = {item["n"] for item in evidence}
    evidence_types = {item["type"] for item in evidence}

    factors = []
    for factor in raw.get("factors") or []:
        refs = [r for r in (factor.get("evidence_refs") or []) if r in valid_refs]
        if not refs:
            continue  # uncited claim — drop it
        factors.append({
            "type": factor.get("type", "news"),
            "description": str(factor.get("description", ""))[:400],
            "evidence_refs": refs,
        })

    cause_type = raw.get("cause_type", "unexplained")
    if cause_type not in CAUSE_TYPES:
        cause_type = "unexplained"

    if not factors:
        cause_type = "unexplained"
        summary = "확인된 공개 요인이 없습니다."
        headline = "공개 요인 미확인"
    else:
        summary = str(raw.get("summary", ""))[:600]
        headline = str(raw.get("headline", ""))[:60] or "원인 요약"

    return {
        "headline": headline,
        "cause_type": cause_type,
        "summary": summary,
        "factors": factors,
        "creator_context_text": raw.get("creator_context"),
        # Confidence is a property of the evidence, not of how sure the model sounds.
        "confidence": _confidence(evidence_types, factors),
        "llm_model": MODEL,
    }


def _confidence(evidence_types: set[str], factors: list[dict]) -> str:
    if not factors:
        return "low"
    substantive = evidence_types & {"disclosure", "flow", "news"}
    if "disclosure" in evidence_types and len(substantive) >= 2:
        return "high"
    if len(substantive) >= 1:
        return "medium"
    return "low"


def _rule_based(candidate, evidence: list[dict]) -> dict:
    """Deterministic fallback so the page is never empty when the LLM is down."""
    parts = []
    counts: dict[str, int] = {}
    for item in evidence:
        counts[item["type"]] = counts.get(item["type"], 0) + 1
    labels = {"disclosure": "공시", "flow": "수급", "news": "뉴스",
              "creator": "크리에이터 언급", "market": "시장 전체"}
    for kind, count in counts.items():
        parts.append(f"{labels.get(kind, kind)} {count}건")

    return {
        "headline": f"{candidate.change_pct:+.1f}% 변동",
        "cause_type": "unexplained",
        "summary": f"확인된 공개 정보: {', '.join(parts)}. 원인 분석은 생략되었습니다.",
        "factors": [],
        "creator_context_text": None,
        "confidence": "low",
        "llm_model": "fallback",
    }


def _unexplained(candidate, reason: str) -> dict:
    return {
        "headline": "공개 요인 미확인",
        "cause_type": "unexplained",
        "summary": "확인된 공개 요인이 없습니다.",
        "factors": [],
        "creator_context_text": None,
        "confidence": "low",
        "llm_model": reason,
    }
