"""Channel PIS (Prediction Intensity Score) calculator and classifier.

Classifies channels into: predictor, leader, analyst, media, unknown
based on 5 weighted metrics from their recent video content.
"""
from __future__ import annotations

import re
from datetime import datetime

import psycopg2.extras

from prediction_detector import (
    BUY_PATTERNS,
    SELL_PATTERNS,
    PRICE_TARGET_PATTERNS,
    DIRECT_ACTION_KEYWORDS,
)

# === PIS Weights ===
PIS_WEIGHTS = {
    "p1_density": 0.30,
    "p2_action_intensity": 0.25,
    "p3_concentration": 0.20,
    "p4_price_target": 0.15,
    "p5_sentiment_bias": 0.10,
}

# === Classification Thresholds ===
# Adjusted for title+description-only analysis (subtitles rarely available)
# Scores are naturally lower without subtitle text
LEADER_MIN_PIS = 50
PREDICTOR_MIN_PIS = 30
ANALYST_MIN_PIS = 15

# Leader title patterns (Korean)
LEADER_TITLE_PATTERNS = [
    "실시간", "라이브", "리딩", "매매일지", "오늘의 종목",
    "종목 추천", "급등주", "단타", "데이트레이딩", "시그널",
]

# Minimum videos required for classification
MIN_VIDEOS_FOR_CLASSIFICATION = 5


class ChannelClassifier:
    """Calculates PIS and classifies a channel."""

    def __init__(self, conn):
        self.conn = conn

    def classify_channel(self, channel_id: str, days: int = 30) -> dict:
        """Classify a single channel. Returns {channel_type, pis, details}."""
        videos = self._get_recent_videos(channel_id, days)

        if len(videos) < MIN_VIDEOS_FOR_CLASSIFICATION:
            return {
                "channel_type": "unknown",
                "pis": 0.0,
                "details": {"total_videos_analyzed": len(videos), "reason": "insufficient_data"},
            }

        p1 = self._calc_prediction_density(channel_id, videos)
        p2 = self._calc_action_intensity(videos)
        p3 = self._calc_asset_concentration(channel_id, days)
        p4 = self._calc_price_target_freq(videos)
        p5 = self._calc_sentiment_bias(channel_id, days)

        pis = (
            p1 * PIS_WEIGHTS["p1_density"]
            + p2 * PIS_WEIGHTS["p2_action_intensity"]
            + p3 * PIS_WEIGHTS["p3_concentration"]
            + p4 * PIS_WEIGHTS["p4_price_target"]
            + p5 * PIS_WEIGHTS["p5_sentiment_bias"]
        )

        channel_type = self._determine_type(pis, videos)

        dates = [v["published_at"] for v in videos if v.get("published_at")]
        details = {
            "p1_density": round(p1, 1),
            "p2_action_intensity": round(p2, 1),
            "p3_concentration": round(p3, 1),
            "p4_price_target": round(p4, 1),
            "p5_sentiment_bias": round(p5, 1),
            "total_videos_analyzed": len(videos),
            "period_start": str(min(dates).date()) if dates else None,
            "period_end": str(max(dates).date()) if dates else None,
        }

        return {
            "channel_type": channel_type,
            "pis": round(pis, 1),
            "details": details,
        }

    # --- P1: Prediction Density ---

    def _calc_prediction_density(self, channel_id: str, videos: list) -> float:
        """% of videos that have at least 1 prediction (0~100)."""
        if not videos:
            return 0.0

        video_ids = [v["id"] for v in videos]
        placeholders = ",".join(["%s"] * len(video_ids))

        with self.conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(DISTINCT video_id) FROM predictions "
                f"WHERE video_id IN ({placeholders}) AND channel_id = %s",
                video_ids + [channel_id],
            )
            videos_with_pred = cur.fetchone()[0]

        return min((videos_with_pred / len(videos)) * 100, 100)

    # --- P2: Action Keyword Intensity ---

    def _calc_action_intensity(self, videos: list) -> float:
        """Average weighted action keyword score per video (0~100)."""
        if not videos:
            return 0.0

        scores = []
        for v in videos:
            # Use title + description (subtitle often unavailable)
            text = (v.get("title") or "") + " " + (v.get("description") or "") + " " + (v.get("subtitle_text") or "")
            score = 0.0

            # Weighted direct action keywords
            for keyword, weight in DIRECT_ACTION_KEYWORDS:
                if keyword in text:
                    score += weight

            # Basic BUY/SELL patterns (weight 1)
            score += sum(1 for p in BUY_PATTERNS if p in text)
            score += sum(1 for p in SELL_PATTERNS if p in text)

            scores.append(score)

        avg_score = sum(scores) / len(scores)
        # Normalize: avg 2~3 for title-only → scale up more aggressively
        # 0~10 range maps to 0~100
        return min(avg_score * 10, 100)

    # --- P3: Asset Concentration ---

    def _calc_asset_concentration(self, channel_id: str, days: int) -> float:
        """Top 5 assets as % of total mentions (0~100).
        Requires 10+ unique assets to be meaningful; otherwise returns 0.
        High concentration = focused on specific assets (predictor trait).
        """
        with self.conn.cursor() as cur:
            cur.execute(
                """SELECT ma.asset_name, COUNT(*) as cnt
                FROM mentioned_assets ma
                JOIN videos v ON v.id = ma.video_id
                WHERE v.channel_id = %s
                  AND v.published_at >= NOW() - INTERVAL '%s days'
                GROUP BY ma.asset_name
                ORDER BY cnt DESC""",
                (channel_id, days),
            )
            rows = cur.fetchall()

        # Need at least 6 unique assets for concentration to be meaningful
        # With fewer, top5/total is always ~100% which provides no signal
        if len(rows) < 6:
            return 0.0

        total = sum(r[1] for r in rows)
        top5 = sum(r[1] for r in rows[:5])

        return min((top5 / total) * 100, 100) if total > 0 else 0.0

    # --- P4: Price Target Frequency ---

    def _calc_price_target_freq(self, videos: list) -> float:
        """% of videos containing price target patterns (0~100)."""
        if not videos:
            return 0.0

        count = 0
        for v in videos:
            text = (v.get("title") or "") + " " + (v.get("description") or "") + " " + (v.get("subtitle_text") or "")
            if any(re.search(p, text) for p in PRICE_TARGET_PATTERNS):
                count += 1

        return (count / len(videos)) * 100

    # --- P5: Sentiment Bias ---

    def _calc_sentiment_bias(self, channel_id: str, days: int) -> float:
        """|positive% - negative%| average (0~100)."""
        with self.conn.cursor() as cur:
            cur.execute(
                """SELECT
                  COUNT(*) FILTER (WHERE ma.sentiment = 'positive') as pos,
                  COUNT(*) FILTER (WHERE ma.sentiment = 'negative') as neg,
                  COUNT(*) as total
                FROM mentioned_assets ma
                JOIN videos v ON v.id = ma.video_id
                WHERE v.channel_id = %s
                  AND v.published_at >= NOW() - INTERVAL '%s days'""",
                (channel_id, days),
            )
            row = cur.fetchone()

        if not row or row[2] == 0:
            return 0.0

        pos_pct = (row[0] / row[2]) * 100
        neg_pct = (row[1] / row[2]) * 100

        return min(abs(pos_pct - neg_pct), 100)

    # --- Type Determination ---

    def _determine_type(self, pis: float, videos: list) -> str:
        """Determine channel type from PIS + additional signals."""
        if pis >= LEADER_MIN_PIS and self._has_leader_signals(videos):
            return "leader"

        if pis >= PREDICTOR_MIN_PIS:
            return "predictor"

        if pis >= ANALYST_MIN_PIS:
            return "analyst"

        return "media"

    def _has_leader_signals(self, videos: list) -> bool:
        """Check if channel has leader (live trading) signals in titles."""
        if not videos:
            return False

        leader_count = sum(
            1 for v in videos
            if any(p in (v.get("title") or "") for p in LEADER_TITLE_PATTERNS)
        )
        return (leader_count / len(videos)) >= 0.3

    # --- Utility ---

    def _get_recent_videos(self, channel_id: str, days: int) -> list:
        """Fetch recent videos for a channel."""
        with self.conn.cursor() as cur:
            cur.execute(
                """SELECT id, title, description, subtitle_text, published_at, sentiment
                FROM videos
                WHERE channel_id = %s
                  AND published_at >= NOW() - INTERVAL '%s days'
                ORDER BY published_at DESC""",
                (channel_id, days),
            )
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def classify_all_channels(conn, days: int = 30) -> list:
    """Classify all channels and update DB. Returns results list.
    Respects channel_type_override: if set, keeps that type but still updates PIS."""
    classifier = ChannelClassifier(conn)
    results = []

    with conn.cursor() as cur:
        cur.execute("SELECT id, name, category, channel_type_override FROM channels ORDER BY name")
        channels = cur.fetchall()

    for ch_id, ch_name, ch_category, override in channels:
        result = classifier.classify_channel(str(ch_id), days)

        # Use override if set, otherwise use auto-classified type
        final_type = override if override else result["channel_type"]

        with conn.cursor() as cur:
            cur.execute(
                """UPDATE channels SET
                    channel_type = %s,
                    prediction_intensity_score = %s,
                    classification_details = %s,
                    classification_updated_at = NOW()
                WHERE id = %s""",
                (
                    final_type,
                    result["pis"],
                    psycopg2.extras.Json(result["details"]),
                    ch_id,
                ),
            )

        results.append({
            "name": ch_name,
            "category": ch_category,
            "channel_type": final_type,
            "pis": result["pis"],
            "details": result["details"],
            "overridden": bool(override),
        })

    conn.commit()
    return results


def update_stale_classifications(conn, days: int = 30, stale_days: int = 7) -> int:
    """Re-classify channels that haven't been classified in stale_days.
    Respects channel_type_override."""
    classifier = ChannelClassifier(conn)
    updated = 0

    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, channel_type_override FROM channels
            WHERE classification_updated_at IS NULL
               OR classification_updated_at < NOW() - INTERVAL '%s days'""",
            (stale_days,),
        )
        rows = cur.fetchall()

    if not rows:
        return 0

    for ch_id, override in rows:
        result = classifier.classify_channel(str(ch_id), days)
        final_type = override if override else result["channel_type"]

        with conn.cursor() as cur:
            cur.execute(
                """UPDATE channels SET
                    channel_type = %s,
                    prediction_intensity_score = %s,
                    classification_details = %s,
                    classification_updated_at = NOW()
                WHERE id = %s""",
                (
                    final_type,
                    result["pis"],
                    psycopg2.extras.Json(result["details"]),
                    ch_id,
                ),
            )
        updated += 1

    conn.commit()
    return updated
