"""Analyze YouTube comments sentiment as crowd validation for predictions.

Collects comments for videos that have predictions, analyzes sentiment,
and updates comment_sentiment_score on videos + crowd_accuracy on predictions.
"""
from __future__ import annotations

from datetime import datetime

from asset_dictionary import analyze_sentiment
from youtube import get_video_comments, rate_limit_wait


def analyze_video_comments(conn, max_videos: int = 50) -> dict:
    """Fetch and analyze comments for prediction videos that haven't been analyzed yet.

    Priority: videos with predictions that lack comment analysis.
    """
    results = {"analyzed": 0, "skipped": 0, "errors": 0}

    with conn.cursor() as cur:
        # Get prediction videos without comment analysis (most recent first)
        cur.execute("""
            SELECT DISTINCT v.id, v.youtube_video_id, v.title
            FROM videos v
            JOIN predictions p ON p.video_id = v.id
            WHERE v.comments_analyzed_at IS NULL
            ORDER BY v.published_at DESC NULLS LAST
            LIMIT %s
        """, (max_videos,))
        videos = cur.fetchall()

    if not videos:
        print("  No videos need comment analysis")
        return results

    print(f"  Analyzing comments for {len(videos)} prediction videos")

    for vid_uuid, youtube_video_id, title in videos:
        try:
            comments = get_video_comments(youtube_video_id, max_results=30)

            if not comments:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE videos SET comments_analyzed_at = NOW()
                        WHERE id = %s
                    """, (vid_uuid,))
                conn.commit()
                results["skipped"] += 1
                continue

            positive = 0
            negative = 0
            neutral = 0

            for comment in comments:
                text = comment["text"]
                if len(text.strip()) < 5:
                    continue

                sentiment = analyze_sentiment(text)
                if sentiment == "positive":
                    positive += 1
                elif sentiment == "negative":
                    negative += 1
                else:
                    neutral += 1

            total = positive + negative + neutral
            # Score: -1 (all negative) to +1 (all positive), 0 = neutral/balanced
            score = (positive - negative) / total if total > 0 else 0.0

            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE videos SET
                        comment_positive_count = %s,
                        comment_negative_count = %s,
                        comment_neutral_count = %s,
                        comment_total_count = %s,
                        comment_sentiment_score = %s,
                        comments_analyzed_at = NOW()
                    WHERE id = %s
                """, (positive, negative, neutral, total, round(score, 3), vid_uuid))

            conn.commit()
            results["analyzed"] += 1
            print(f"    {title[:50]}... → +{positive} -{negative} ={neutral} (score: {score:.2f})")

            rate_limit_wait(0.2)

        except Exception as e:
            print(f"    Error analyzing {youtube_video_id}: {e}")
            results["errors"] += 1
            try:
                conn.rollback()
            except Exception:
                pass

    return results


def update_crowd_accuracy(conn) -> int:
    """Calculate crowd_accuracy for predictions based on comment sentiment.

    Logic:
    - Positive comment sentiment + buy prediction → crowd agrees → high score
    - Negative comment sentiment + buy prediction → crowd disagrees → low score
    - Score is 0~1 where 1 = crowd strongly agrees with prediction
    """
    updated = 0

    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.prediction_type, v.comment_sentiment_score
            FROM predictions p
            JOIN videos v ON p.video_id = v.id
            WHERE v.comment_sentiment_score IS NOT NULL
              AND p.crowd_accuracy IS NULL
              AND p.prediction_type IS NOT NULL
        """)
        predictions = cur.fetchall()

        for pred_id, pred_type, comment_score in predictions:
            # comment_score: -1 to +1
            # For buy predictions: positive comments = crowd agrees
            # For sell predictions: negative comments = crowd agrees
            # For hold: neutral comments = crowd agrees
            if pred_type == "buy":
                # Map: score +1 → accuracy 1.0, score -1 → accuracy 0.0
                crowd_acc = (comment_score + 1) / 2
            elif pred_type == "sell":
                # Map: score -1 → accuracy 1.0, score +1 → accuracy 0.0
                crowd_acc = (-comment_score + 1) / 2
            else:  # hold
                # Map: score 0 → accuracy 1.0, |score| 1 → accuracy 0.0
                crowd_acc = 1 - abs(comment_score)

            crowd_acc = round(max(0, min(1, crowd_acc)), 3)

            cur.execute(
                "UPDATE predictions SET crowd_accuracy = %s WHERE id = %s",
                (crowd_acc, pred_id),
            )
            updated += 1

        conn.commit()

    print(f"  Updated crowd_accuracy for {updated} predictions")
    return updated


def get_channel_crowd_score(conn, channel_id: str) -> float | None:
    """Get average crowd_accuracy for a channel's predictions."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT AVG(p.crowd_accuracy), COUNT(*)
            FROM predictions p
            WHERE p.channel_id = %s AND p.crowd_accuracy IS NOT NULL
        """, (channel_id,))
        row = cur.fetchone()
        if row and row[1] > 0:
            return round(row[0], 3)
    return None
