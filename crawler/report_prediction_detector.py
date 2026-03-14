"""Map analyst report recommendations to standardized prediction types."""
from __future__ import annotations

from typing import Optional

RECOMMENDATION_MAP: dict[str, str] = {
    # Buy variants
    "매수": "buy",
    "Buy": "buy",
    "Trading Buy": "buy",
    "Outperform": "buy",
    "Overweight": "buy",
    "적극매수": "buy",
    "Strong Buy": "buy",
    "시장수익률상회": "buy",
    "비중확대": "buy",
    # Sell variants
    "매도": "sell",
    "Sell": "sell",
    "Underperform": "sell",
    "Underweight": "sell",
    "시장수익률하회": "sell",
    "비중축소": "sell",
    "Reduce": "sell",
    # Hold variants
    "중립": "hold",
    "Neutral": "hold",
    "Hold": "hold",
    "시장수익률": "hold",
    "Market Perform": "hold",
    "보유": "hold",
    "Equal-Weight": "hold",
    "In-Line": "hold",
    # Not Rated
    "Not Rated": None,
    "NR": None,
    "N/R": None,
    "": None,
}


def map_recommendation(recommendation: Optional[str]) -> Optional[str]:
    """Map analyst recommendation string to buy/sell/hold.

    Args:
        recommendation: Raw recommendation from report (e.g., 'Buy', '매수', 'Outperform')

    Returns:
        Standardized prediction type ('buy', 'sell', 'hold') or None if not recognized
    """
    if not recommendation:
        return None

    cleaned = recommendation.strip()

    # Direct match
    if cleaned in RECOMMENDATION_MAP:
        return RECOMMENDATION_MAP[cleaned]

    # Case-insensitive match
    for key, value in RECOMMENDATION_MAP.items():
        if key.lower() == cleaned.lower():
            return value

    # Partial match (e.g., "Trading Buy" in "Trading Buy(유지)")
    for key, value in RECOMMENDATION_MAP.items():
        if key and key.lower() in cleaned.lower():
            return value

    return None


def determine_confidence(
    recommendation: Optional[str],
    target_price: Optional[float],
) -> str:
    """Determine confidence level for analyst prediction.

    Analyst reports are structured data with explicit recommendations,
    so confidence is generally 'high'. Only returns 'medium' for
    hold/neutral recommendations without target prices.
    """
    if recommendation and target_price is not None:
        return "high"
    if recommendation:
        return "high"
    return "medium"
