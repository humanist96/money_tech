"""Unified NLP pipeline for all MoneyTech crawlers."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from asset_dictionary import (
    DynamicAssetDictionary,
    find_assets_in_text,
    analyze_sentiment,
    analyze_sentiment_for_asset,
    generate_simple_summary,
)

# Module-level dynamic dictionary (DB-backed with hardcoded fallback)
_asset_dict = DynamicAssetDictionary()
from llm_analyzer import LLMAnalyzer
from logger import logger
from prediction_detector import detect_predictions
from report_prediction_detector import map_recommendation, determine_confidence

# Repeat calls inside this window count as one bet (see evaluator_v2).
DUPLICATE_WINDOW_DAYS = 30


@dataclass
class NLPResult:
    """Result of NLP pipeline processing."""

    assets: list[dict] = field(default_factory=list)
    sentiment: str = "neutral"
    asset_sentiments: dict[str, str] = field(default_factory=dict)
    predictions: list[dict] = field(default_factory=list)
    summary: str = ""
    key_points: list[str] = field(default_factory=list)
    detection_method: str = "keyword"
    # Report-specific fields
    prediction_type: Optional[str] = None
    confidence: Optional[str] = None
    target_price: Optional[float] = None
    previous_target_price: Optional[float] = None


class NLPPipeline:
    """Unified NLP processing for all platforms.

    Handles asset detection, sentiment analysis, prediction detection,
    and summary generation across YouTube, blog, Telegram, and analyst
    report crawlers.
    """

    def __init__(self):
        self._llm = LLMAnalyzer()

    def process(
        self,
        text: str,
        title: str,
        platform: str = "default",
        *,
        report=None,
        use_llm: bool = False,
    ) -> NLPResult:
        """Run full NLP pipeline on content text.

        Args:
            text: Combined text content to analyze.
            title: Content title (used for summary generation).
            platform: Source platform ('default', 'telegram', 'analyst_report').
            report: AnalystReport object (required when platform='analyst_report').
            use_llm: If True, try LLM analysis first before keyword fallback.

        Returns:
            NLPResult with assets, sentiments, predictions, and summary.
        """
        if platform == "analyst_report":
            return self._process_report(report)

        # Try LLM first if requested and available
        if use_llm and self._llm.available:
            llm_result = self._llm.analyze(text, title, platform)
            if llm_result:
                return self._convert_llm_result(llm_result, title)

        # Fallback to keyword-based
        return self._process_general(text, title, platform)

    def _process_general(self, text: str, title: str, platform: str) -> NLPResult:
        """General NLP pipeline for YouTube, blog, and Telegram content."""
        found_assets = _asset_dict.find_assets_in_text(text)
        sentiment = analyze_sentiment(text)

        # Compute per-asset sentiment from text context
        asset_sentiments: dict[str, str] = {}
        for asset in found_assets:
            asset_sentiments[asset["asset_name"]] = analyze_sentiment_for_asset(
                text, asset["asset_name"]
            )

        preds: list[dict] = []
        if found_assets:
            preds = detect_predictions(text, found_assets, platform=platform)

        summary = generate_simple_summary(title, found_assets, sentiment)

        return NLPResult(
            assets=found_assets,
            sentiment=sentiment,
            asset_sentiments=asset_sentiments,
            predictions=preds,
            summary=summary,
        )

    def _convert_llm_result(self, llm_result: dict, title: str) -> NLPResult:
        """Convert LLM JSON output to NLPResult format."""
        # Map LLM assets to standard format
        assets: list[dict] = []
        asset_sentiments: dict[str, str] = {}
        for item in llm_result.get("assets", []):
            asset_name = item.get("name", "")
            asset_type = item.get("type", "stock")
            asset_code = item.get("code", "")
            sentiment = item.get("sentiment", "neutral")

            # 부동산 스코프 제외(Phase A5) — 프롬프트로 막아도 LLM이 간혹
            # real_estate를 반환하므로 저장 전 차단
            if asset_type not in ("stock", "coin"):
                continue

            assets.append({
                "asset_type": asset_type,
                "asset_name": asset_name,
                "asset_code": asset_code,
            })
            asset_sentiments[asset_name] = sentiment

        # Map LLM predictions to standard format
        predictions: list[dict] = []
        type_map = {"buy": "buy", "sell": "sell", "hold": "hold"}
        # Assets carry their own type; hardcoding 'stock' here sent coin calls
        # to the stock price source and left them permanently unevaluable.
        asset_types = {a["asset_name"]: a["asset_type"] for a in assets}
        for pred in llm_result.get("predictions", []):
            pred_type = type_map.get(pred.get("type", ""), pred.get("type", ""))
            pred_asset = pred.get("asset_name", "")
            predictions.append({
                "asset_name": pred_asset,
                "asset_code": pred.get("asset_code", ""),
                "asset_type": asset_types.get(pred_asset, "stock"),
                "prediction_type": pred_type,
                "reason": pred.get("reason", ""),
            })

        overall_sentiment = llm_result.get("overall_sentiment", "neutral")
        summary = llm_result.get("summary", title) or title
        key_points = llm_result.get("key_points", [])

        return NLPResult(
            assets=assets,
            sentiment=overall_sentiment,
            asset_sentiments=asset_sentiments,
            predictions=predictions,
            summary=summary,
            key_points=key_points,
            detection_method="llm",
        )

    def _process_report(self, report) -> NLPResult:
        """Analyst report pipeline using structured recommendation data."""
        pred_type = map_recommendation(report.recommendation)
        confidence_val = determine_confidence(
            report.recommendation, report.target_price
        )

        sentiment = (
            "positive"
            if pred_type == "buy"
            else "negative"
            if pred_type == "sell"
            else "neutral"
        )

        # Build structured summary
        summary_parts = [f"{report.firm_name}: {report.asset_name}"]
        if report.recommendation:
            summary_parts.append(f"의견={report.recommendation}")
        if report.target_price:
            summary_parts.append(f"목표가={report.target_price:,.0f}원")
        summary = " | ".join(summary_parts)

        # Single asset from report
        assets = [
            {
                "asset_type": "stock",
                "asset_name": report.asset_name,
                "asset_code": report.asset_code,
            }
        ]

        predictions: list[dict] = []
        if pred_type:
            predictions.append(
                {
                    "asset_name": report.asset_name,
                    "asset_code": report.asset_code,
                    "asset_type": "stock",
                    "prediction_type": pred_type,
                    "reason": report.recommendation or "",
                }
            )

        return NLPResult(
            assets=assets,
            sentiment=sentiment,
            asset_sentiments={report.asset_name: sentiment},
            predictions=predictions,
            summary=summary,
            prediction_type=pred_type,
            confidence=confidence_val,
            target_price=report.target_price,
            previous_target_price=report.previous_target,
        )

    def store_results(
        self,
        cur,
        conn,
        video_uuid: str,
        channel_uuid: str,
        result: NLPResult,
        published_at: Optional[str] = None,
        *,
        platform: str = "default",
    ) -> None:
        """Store NLP results to database.

        Replaces duplicated upsert logic across all crawlers:
        - Upserts mentioned_assets with per-asset sentiment
        - Upserts predictions
        - Updates video summary and sentiment

        Args:
            cur: Database cursor.
            conn: Database connection.
            video_uuid: UUID of the video/post/message record.
            channel_uuid: UUID of the channel record.
            result: NLPResult from process().
            published_at: Publication timestamp for predictions.
            platform: Source platform ('default' or 'analyst_report').
        """
        # Refresh asset dictionary from DB if cache expired
        _asset_dict.refresh(cur)

        if platform == "analyst_report":
            self._store_report_results(
                cur, conn, video_uuid, channel_uuid, result, published_at
            )
        else:
            self._store_general_results(
                cur, conn, video_uuid, channel_uuid, result, published_at
            )

    def _store_general_results(
        self,
        cur,
        conn,
        video_uuid: str,
        channel_uuid: str,
        result: NLPResult,
        published_at: Optional[str],
    ) -> None:
        """Store results for YouTube, blog, and Telegram content."""
        detection_method = result.detection_method
        contradictions = 0
        if result.assets:
            for asset in result.assets:
                asset_sentiment = result.asset_sentiments.get(
                    asset["asset_name"], result.sentiment
                )
                cur.execute(
                    """INSERT INTO mentioned_assets
                    (video_id, asset_type, asset_name, asset_code, sentiment)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (video_id, asset_name) DO UPDATE SET
                        sentiment = EXCLUDED.sentiment""",
                    (
                        video_uuid,
                        asset["asset_type"],
                        asset["asset_name"],
                        asset["asset_code"],
                        asset_sentiment,
                    ),
                )

            # Store predictions
            for pred in result.predictions:
                cur.execute(
                    "SELECT id FROM mentioned_assets WHERE video_id = %s AND asset_name = %s",
                    (video_uuid, pred["asset_name"]),
                )
                ma_row = cur.fetchone()
                if ma_row:
                    # A repeat is the immediately preceding call on the same
                    # (channel, asset) being the same direction inside the
                    # window; a reversal in between starts a new bet. Keyed on
                    # asset_code to match the backfill — keying on asset_name
                    # made the two paths disagree about what "same asset" means.
                    cur.execute(
                        """SELECT p.prediction_type, p.predicted_at
                           FROM predictions p
                           JOIN mentioned_assets ma2 ON ma2.id = p.mentioned_asset_id
                           WHERE p.channel_id = %s
                             AND COALESCE(ma2.asset_code, ma2.asset_name) = %s
                             AND p.predicted_at < COALESCE(%s::timestamptz, NOW())
                           ORDER BY p.predicted_at DESC
                           LIMIT 1""",
                        (
                            channel_uuid,
                            pred.get("asset_code") or pred["asset_name"],
                            published_at,
                        ),
                    )
                    prev = cur.fetchone()
                    is_duplicate = False
                    if prev and prev[0] == pred["prediction_type"] and prev[1]:
                        predicted_dt = published_at or datetime.now(timezone.utc).isoformat()
                        cur.execute(
                            "SELECT (%s::timestamptz - %s) < INTERVAL '%s days'",
                            (predicted_dt, prev[1], DUPLICATE_WINDOW_DAYS),
                        )
                        is_duplicate = bool(cur.fetchone()[0])

                    # 021의 유니크 인덱스는 (video, asset)당 한 건만 살려둔다.
                    # 지금까지 이 자리가 bare `DO NOTHING`이라, 같은 영상에서
                    # 같은 종목에 반대 방향이 나오면 **두 번째가 행 없이
                    # 사라졌다** — 첫 콜만 평가되니 헤징이 적중률을 부풀리는
                    # 것을 막지 못했다. 계획 §3.3은 "둘 다 모순 예측으로 평가
                    # 제외"이므로, 충돌 시 기존 행을 contradictory로 승격해
                    # 함께 표본에서 빼고 그 사실을 남긴다 (G33).
                    cur.execute(
                        """INSERT INTO predictions
                        (video_id, channel_id, mentioned_asset_id, prediction_type, reason,
                         predicted_at, detection_method, is_duplicate)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (video_id, mentioned_asset_id) WHERE NOT is_duplicate
                        DO UPDATE SET
                            evaluation_status = CASE
                                WHEN predictions.prediction_type
                                     IS DISTINCT FROM EXCLUDED.prediction_type
                                THEN 'contradictory'
                                ELSE predictions.evaluation_status END,
                            is_duplicate = CASE
                                WHEN predictions.prediction_type
                                     IS DISTINCT FROM EXCLUDED.prediction_type
                                THEN TRUE
                                ELSE predictions.is_duplicate END
                        RETURNING evaluation_status""",
                        (
                            video_uuid,
                            channel_uuid,
                            str(ma_row[0]),
                            pred["prediction_type"],
                            pred.get("reason", ""),
                            published_at,
                            pred.get("detection_method", detection_method),
                            is_duplicate,
                        ),
                    )
                    written = cur.fetchone()
                    if written and written[0] == "contradictory":
                        contradictions += 1
            if result.predictions:
                logger.info(f"    Detected {len(result.predictions)} predictions")
            if contradictions:
                # 조용히 버리지 않는다 — 헤징이 얼마나 들어오는지가 감지기
                # 품질의 신호다.
                logger.info(
                    "    %d contradictory prediction(s) excluded (buy/sell on same asset)",
                    contradictions,
                )

            conn.commit()
            logger.info(f"    Found {len(result.assets)} assets mentioned")

        # Update video summary and sentiment
        cur.execute(
            """UPDATE videos SET summary = %s, sentiment = %s
            WHERE id = %s""",
            (result.summary, result.sentiment, video_uuid),
        )
        conn.commit()

    def _store_report_results(
        self,
        cur,
        conn,
        video_uuid: str,
        channel_uuid: str,
        result: NLPResult,
        published_at: Optional[str],
    ) -> None:
        """Store results for analyst reports with target price and confidence."""
        if not result.assets:
            return

        asset = result.assets[0]

        # Upsert mentioned asset
        cur.execute(
            """INSERT INTO mentioned_assets
            (video_id, asset_type, asset_name, asset_code, sentiment)
            VALUES (%s, 'stock', %s, %s, %s)
            ON CONFLICT (video_id, asset_name) DO UPDATE SET
                sentiment = EXCLUDED.sentiment""",
            (
                video_uuid,
                asset["asset_name"],
                asset["asset_code"],
                result.sentiment,
            ),
        )

        # Get mentioned_asset_id
        cur.execute(
            "SELECT id FROM mentioned_assets WHERE video_id = %s AND asset_name = %s",
            (video_uuid, asset["asset_name"]),
        )
        ma_row = cur.fetchone()
        if not ma_row:
            conn.commit()
            return

        # Insert prediction with target price and confidence
        if result.prediction_type:
            cur.execute(
                """INSERT INTO predictions
                (video_id, channel_id, mentioned_asset_id, prediction_type,
                 target_price, previous_target_price, confidence, reason, predicted_at,
                 detection_method)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'report')
                ON CONFLICT (video_id, mentioned_asset_id) WHERE NOT is_duplicate
                DO UPDATE SET
                    evaluation_status = CASE
                        WHEN predictions.prediction_type
                             IS DISTINCT FROM EXCLUDED.prediction_type
                        THEN 'contradictory'
                        ELSE predictions.evaluation_status END,
                    is_duplicate = CASE
                        WHEN predictions.prediction_type
                             IS DISTINCT FROM EXCLUDED.prediction_type
                        THEN TRUE
                        ELSE predictions.is_duplicate END""",
                (
                    video_uuid,
                    channel_uuid,
                    str(ma_row[0]),
                    result.prediction_type,
                    result.target_price,
                    result.previous_target_price,
                    result.confidence,
                    result.predictions[0].get("reason", "")
                    if result.predictions
                    else "",
                    published_at,
                ),
            )

        # Update video summary and sentiment
        cur.execute(
            """UPDATE videos SET summary = %s, sentiment = %s
            WHERE id = %s""",
            (result.summary, result.sentiment, video_uuid),
        )
        conn.commit()

        if result.prediction_type:
            tp_str = (
                f", 목표가={result.target_price:,.0f}원"
                if result.target_price
                else ""
            )
            logger.info(f"    Prediction: {result.prediction_type}{tp_str}")
