"""Detect buy/sell/hold predictions from video content."""
from __future__ import annotations

import re

BUY_PATTERNS = [
    "매수", "사세요", "사야", "담으세요", "담아", "적극 추천", "강력 추천",
    "들어가세요", "진입", "매집", "저점 매수", "분할 매수", "물타기",
    "오를 겁", "상승할", "올라갈", "급등할", "폭등할",
    "목표가", "저평가", "지금이 기회", "바닥", "반등",
]

SELL_PATTERNS = [
    "매도", "팔아", "팔으세요", "빠지세요", "손절", "익절",
    "나오세요", "탈출", "정리하세요",
    "내릴 겁", "하락할", "떨어질", "급락할", "폭락할",
    "고평가", "버블", "위험", "고점", "탈출해야",
]

HOLD_PATTERNS = [
    "관망", "지켜봐", "기다려", "보수적", "조심",
    "아직은", "때가 아닌", "섣불리",
    "횡보", "눈치", "대기", "관전",
]

# --- Price Target Patterns (for channel classification P4 metric) ---

PRICE_TARGET_PATTERNS = [
    r'목표가\s*:?\s*[\d,]+\s*원?',
    r'[\d,]+\s*원\s*(돌파|이탈|지지|저항)',
    r'[\d.]+\s*(달러|불)\s*(돌파|이탈|도달)',
    r'\$\s*[\d,.]+\s*(target|돌파|이탈)',
    r'(TP|타겟|타깃|목표)\s*:?\s*[\d,]+',
    r'(1차|2차|3차)\s*목표\s*:?\s*[\d,]+',
    r'[\d,.]+K?\s*(돌파|이탈|지지|저항)',
    r'(저항|지지)선?\s*:?\s*[\d,.]+',
    r'손절\s*:?\s*[\d,]+',
    r'익절\s*:?\s*[\d,]+',
    r'(스탑로스|stop\s*loss)\s*:?\s*[\d,]+',
    r'(수익률|목표|기대)\s*[\d]+\s*%',
]

# --- Direct Action Keywords with weights (for channel classification P2 metric) ---

DIRECT_ACTION_KEYWORDS = [
    # 2x weight - imperative commands
    ("사세요", 2), ("팔으세요", 2), ("들어가세요", 2),
    ("빠지세요", 2), ("손절하세요", 2), ("담으세요", 2),
    ("지금 바로", 2), ("즉시 매수", 2), ("즉시 매도", 2),
    # 1.5x weight - strong recommendations
    ("매수", 1.5), ("매도", 1.5), ("목표가", 1.5),
    ("진입", 1.5), ("탈출", 1.5), ("적극 추천", 1.5),
    ("강력 추천", 1.5), ("손절가", 1.5), ("익절가", 1.5),
]


def detect_predictions(text: str, found_assets: list[dict]) -> list[dict]:
    """
    Detect buy/sell/hold predictions for each mentioned asset.
    Uses context around each asset mention for per-asset predictions.
    """
    if not found_assets or not text:
        return []

    predictions = []

    for asset in found_assets:
        # Find context around this asset
        idx = text.find(asset["asset_name"])
        if idx == -1:
            continue

        start = max(0, idx - 300)
        end = min(len(text), idx + len(asset["asset_name"]) + 300)
        context = text[start:end]

        buy_score = sum(1 for p in BUY_PATTERNS if p in context)
        sell_score = sum(1 for p in SELL_PATTERNS if p in context)
        hold_score = sum(1 for p in HOLD_PATTERNS if p in context)

        if buy_score <= 1 and sell_score <= 1 and hold_score <= 1:
            # Fall back to full text if no local signal
            buy_score = sum(1 for p in BUY_PATTERNS if p in text)
            sell_score = sum(1 for p in SELL_PATTERNS if p in text)
            hold_score = sum(1 for p in HOLD_PATTERNS if p in text)

            if buy_score <= 1 and sell_score <= 1 and hold_score <= 1:
                continue

        if buy_score > sell_score and buy_score > hold_score:
            pred_type = "buy"
        elif sell_score > buy_score and sell_score > hold_score:
            pred_type = "sell"
        elif hold_score > 0:
            pred_type = "hold"
        else:
            continue

        reason_keywords = []
        all_patterns = BUY_PATTERNS + SELL_PATTERNS + HOLD_PATTERNS
        for p in all_patterns:
            if p in context:
                reason_keywords.append(p)

        predictions.append({
            "asset_name": asset["asset_name"],
            "asset_code": asset["asset_code"],
            "asset_type": asset["asset_type"],
            "prediction_type": pred_type,
            "reason": ", ".join(reason_keywords[:5]),
        })

    return predictions
