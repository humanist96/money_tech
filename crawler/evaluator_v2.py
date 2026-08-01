"""Prediction scoring, version 2.

What changed from v1 and why:

  - Prices are read from history by date, so a 1-week result is measured a week
    after the call rather than whenever the script happened to run.
  - Calls are judged on return *in excess of* the market, so a rising tide no
    longer counts as skill.
  - Moves inside a cost band count as neither hit nor miss; a +0.01% drift is
    not a correct call, and it should not dilute the sample either.
  - Ranking uses the lower bound of the Wilson interval, so a handful of lucky
    calls cannot outrank a long, consistent record.
  - Delisted tickers resolve as outcomes (a bought stock going to zero is a
    miss), instead of being dropped and quietly flattering everyone's average.

Every row records evaluation_version, so changing any rule here means bumping
the version rather than overwriting history computed under the old one.
"""
from __future__ import annotations

from datetime import date, timedelta

from logger import logger
from price_history import (
    MAX_DATE_SLACK_DAYS,
    get_benchmark_asof,
    get_price_asof,
    today_kst,
)

EVALUATION_VERSION = 2

# Horizon in calendar days.
HORIZONS = {"1w": 7, "1m": 30, "3m": 90}

# Moves smaller than this are treated as noise//transaction cost, not signal.
# Widening with the horizon reflects the larger dispersion over longer windows.
BANDS = {"1w": 0.015, "1m": 0.025, "3m": 0.04}

# BTC has no meaningful benchmark, so it is judged on absolute return with a
# wider band — otherwise a coin channel repeating "buy BTC" in a bull market
# would collect the same mechanical wins benchmarking was meant to remove.
ABSOLUTE_BAND_MULTIPLIER = 2.0

MIN_SAMPLE_FOR_RANKING = 10

# Commit every N predictions. A single transaction across the whole backlog
# held one connection open long enough for the server to drop it, and took all
# completed work down with it.
COMMIT_EVERY = 100


def wilson_interval(hits: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% confidence interval for a proportion.

    Chosen over a Bayesian shrinkage prior because benchmark-adjusted outcomes
    make p=0.5 the natural null, and this needs no prior to argue about.
    """
    if n <= 0:
        return (0.0, 1.0)
    p = hits / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = (z / denom) * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return (max(0.0, center - margin), min(1.0, center + margin))


def resolve_benchmark(asset_type: str, market: str | None, asset_code: str | None = None) -> str | None:
    """Which benchmark a given asset is measured against (None = absolute).

    BTC has to be excluded explicitly: benchmarking it against itself makes its
    excess return identically zero, so every BTC call would land inside the
    band and be dropped as a push — silently erasing the record of any channel
    that mostly talks about BTC.
    """
    if asset_type == "stock":
        if market and market.upper() == "KOSDAQ":
            return "KOSDAQ"
        return "KOSPI"
    if asset_type == "coin":
        if (asset_code or "").upper() == "BTC":
            return None  # judged on absolute return with a widened band
        return "BTC"
    return None


# A target within this band of the current price is not a directional call.
TARGET_NEUTRAL_BAND = 0.03


def direction_from_target(target_price: float, price_t0: float) -> str:
    """Direction implied by an analyst target versus the price when published.

    v1 compared a 12-month target against a 1-month price and called the gap an
    error rate, which measured nothing. The defensible signal in a target is its
    direction, judged on the same horizons and benchmark as every other call.
    """
    gap = target_price / price_t0 - 1
    if gap > TARGET_NEUTRAL_BAND:
        return "buy"
    if gap < -TARGET_NEUTRAL_BAND:
        return "sell"
    return "hold"


def classify(prediction_type: str, excess: float, band: float) -> str:
    """hit / miss / push for one prediction at one horizon."""
    if abs(excess) <= band:
        # 'hold' is a claim that nothing much happens, so a flat move is correct.
        return "hit" if prediction_type == "hold" else "push"
    if prediction_type == "buy":
        return "hit" if excess > 0 else "miss"
    if prediction_type == "sell":
        return "hit" if excess < 0 else "miss"
    if prediction_type == "hold":
        return "miss"
    return "push"


def _fetch_pending(cur, limit: int | None = None) -> list[tuple]:
    """Predictions that still need at least one horizon evaluated."""
    sql = """
        SELECT p.id, p.prediction_type, p.predicted_at::date, p.channel_id,
               ma.asset_code, ma.asset_type, ad.market, ad.is_delisted,
               p.target_price
        FROM predictions p
        JOIN mentioned_assets ma ON p.mentioned_asset_id = ma.id
        LEFT JOIN asset_dictionary ad ON ad.asset_code = ma.asset_code
        WHERE NOT p.is_duplicate
          AND p.prediction_type IN ('buy', 'sell', 'hold')
          AND ma.asset_code IS NOT NULL
          AND p.predicted_at IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM (SELECT unnest(ARRAY['1w','1m','3m']) AS h) hs
              WHERE NOT EXISTS (
                  SELECT 1 FROM prediction_evaluations pe
                  WHERE pe.prediction_id = p.id
                    AND pe.horizon = hs.h
                    AND pe.evaluation_version = %s
              )
          )
        ORDER BY p.predicted_at ASC
    """
    params: list = [EVALUATION_VERSION]
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    cur.execute(sql, params)
    return cur.fetchall()


def _existing_horizons(cur, prediction_id) -> set[str]:
    cur.execute(
        """SELECT horizon FROM prediction_evaluations
           WHERE prediction_id = %s AND evaluation_version = %s""",
        (prediction_id, EVALUATION_VERSION),
    )
    return {row[0] for row in cur.fetchall()}


def _record(cur, prediction_id, horizon: str, **fields) -> None:
    cur.execute(
        """INSERT INTO prediction_evaluations
           (prediction_id, horizon, eval_date, price_t0, price_th, asset_return,
            benchmark_code, benchmark_return, excess_return, outcome,
            unevaluable_reason, evaluation_version)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT (prediction_id, horizon, evaluation_version) DO UPDATE SET
               eval_date = EXCLUDED.eval_date,
               price_t0 = EXCLUDED.price_t0,
               price_th = EXCLUDED.price_th,
               asset_return = EXCLUDED.asset_return,
               benchmark_code = EXCLUDED.benchmark_code,
               benchmark_return = EXCLUDED.benchmark_return,
               excess_return = EXCLUDED.excess_return,
               outcome = EXCLUDED.outcome,
               unevaluable_reason = EXCLUDED.unevaluable_reason,
               evaluated_at = NOW()""",
        (
            prediction_id, horizon, fields.get("eval_date"),
            fields.get("price_t0"), fields.get("price_th"), fields.get("asset_return"),
            fields.get("benchmark_code"), fields.get("benchmark_return"),
            fields.get("excess_return"), fields["outcome"],
            fields.get("unevaluable_reason"), EVALUATION_VERSION,
        ),
    )


def evaluate_predictions(conn, limit: int | None = None) -> dict[str, int]:
    """Score every prediction whose horizons have come due."""
    counts = {"hit": 0, "miss": 0, "push": 0, "unevaluable": 0, "not_due": 0}
    today = today_kst()

    with conn.cursor() as cur:
        pending = _fetch_pending(cur, limit)
        logger.info("Evaluating %d prediction(s)", len(pending))

        for processed, (pred_id, ptype, t0, channel_id, asset_code,
                        asset_type, market, is_delisted, target_price) in enumerate(pending, 1):
            if t0 is None:
                continue

            done = _existing_horizons(cur, pred_id)
            benchmark_code = resolve_benchmark(asset_type, market, asset_code)
            base = get_price_asof(cur, asset_code, t0)

            # An analyst call often carries only a target price, no verb. The
            # target relative to the price at publication is the direction.
            if ptype == "hold" and target_price and base and base[0] > 0:
                ptype = direction_from_target(float(target_price), base[0])

            for horizon, days in HORIZONS.items():
                if horizon in done:
                    continue

                target: date = t0 + timedelta(days=days)
                if target > today:
                    counts["not_due"] += 1
                    continue

                if base is None:
                    _record(cur, pred_id, horizon, outcome="unevaluable",
                            unevaluable_reason="no_price_at_t0")
                    counts["unevaluable"] += 1
                    continue

                price_t0, _ = base

                if is_delisted:
                    # Treated as a resolved outcome: a delisted holding is the
                    # worst case for a buy call and the best case for a sell.
                    outcome = "miss" if ptype == "buy" else "hit" if ptype == "sell" else "miss"
                    _record(cur, pred_id, horizon, eval_date=target, price_t0=price_t0,
                            price_th=0, asset_return=-1.0, benchmark_code=benchmark_code,
                            excess_return=-1.0, outcome=outcome,
                            unevaluable_reason="delisted")
                    counts[outcome] += 1
                    continue

                later = get_price_asof(cur, asset_code, target)
                if later is None:
                    _record(cur, pred_id, horizon, outcome="unevaluable",
                            unevaluable_reason="no_price_at_horizon")
                    counts["unevaluable"] += 1
                    continue

                price_th, eval_date = later
                if price_t0 <= 0:
                    _record(cur, pred_id, horizon, outcome="unevaluable",
                            unevaluable_reason="invalid_base_price")
                    counts["unevaluable"] += 1
                    continue

                asset_return = price_th / price_t0 - 1

                benchmark_return = None
                band = BANDS[horizon]
                if benchmark_code:
                    b0 = get_benchmark_asof(cur, benchmark_code, t0)
                    bh = get_benchmark_asof(cur, benchmark_code, eval_date)
                    if b0 and bh and b0[0] > 0:
                        benchmark_return = bh[0] / b0[0] - 1
                    else:
                        benchmark_code = None

                if benchmark_return is None:
                    band *= ABSOLUTE_BAND_MULTIPLIER

                excess = asset_return - (benchmark_return or 0.0)
                outcome = classify(ptype, excess, band)

                _record(cur, pred_id, horizon, eval_date=eval_date, price_t0=price_t0,
                        price_th=price_th, asset_return=asset_return,
                        benchmark_code=benchmark_code, benchmark_return=benchmark_return,
                        excess_return=excess, outcome=outcome)
                counts[outcome] += 1

            cur.execute(
                """UPDATE predictions SET evaluation_status = CASE
                       WHEN EXISTS (SELECT 1 FROM prediction_evaluations pe
                                    WHERE pe.prediction_id = %s
                                      AND pe.evaluation_version = %s
                                      AND pe.outcome IN ('hit','miss','push'))
                       THEN 'evaluated' ELSE evaluation_status END
                   WHERE id = %s""",
                (pred_id, EVALUATION_VERSION, pred_id),
            )

            if processed % COMMIT_EVERY == 0:
                conn.commit()
                logger.info("  evaluated %d/%d", processed, len(pending))

        conn.commit()

    logger.info("Evaluation counts: %s", counts)
    return counts


def update_channel_stats(conn) -> int:
    """Recompute per-channel, per-horizon aggregates from the evaluation rows."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.channel_id, pe.horizon,
                   COUNT(*) FILTER (WHERE pe.outcome IN ('hit','miss'))::int          AS n_effective,
                   COUNT(*) FILTER (WHERE pe.outcome = 'hit')::int                    AS n_hits,
                   COUNT(*) FILTER (WHERE pe.outcome = 'push')::int                   AS n_push,
                   COUNT(*) FILTER (WHERE pe.outcome = 'unevaluable')::int            AS n_unevaluable,
                   COUNT(*) FILTER (WHERE p.prediction_type = 'buy'
                                      AND pe.outcome IN ('hit','miss'))::int          AS n_buy,
                   COUNT(*) FILTER (WHERE p.prediction_type = 'sell'
                                      AND pe.outcome IN ('hit','miss'))::int          AS n_sell,
                   COUNT(*) FILTER (WHERE p.prediction_type = 'hold'
                                      AND pe.outcome IN ('hit','miss'))::int          AS n_hold,
                   -- Scored on absolute return (BTC) rather than vs a benchmark;
                   -- surfaced so a mixed-scale record is visible, not hidden.
                   COUNT(*) FILTER (WHERE pe.benchmark_code IS NULL
                                      AND pe.outcome IN ('hit','miss'))::int          AS n_absolute,
                   AVG(pe.excess_return) FILTER (WHERE pe.outcome IN ('hit','miss'))  AS avg_excess,
                   STDDEV_SAMP(pe.excess_return) FILTER (WHERE pe.outcome IN ('hit','miss')) AS std_excess
            FROM prediction_evaluations pe
            JOIN predictions p ON p.id = pe.prediction_id
            WHERE pe.evaluation_version = %s AND NOT p.is_duplicate
            GROUP BY p.channel_id, pe.horizon
            """,
            (EVALUATION_VERSION,),
        )
        rows = cur.fetchall()

        for (channel_id, horizon, n_eff, n_hits, n_push, n_unev,
             n_buy, n_sell, n_hold, n_absolute, avg_excess, std_excess) in rows:
            hit_rate = (n_hits / n_eff) if n_eff else None
            low, high = wilson_interval(n_hits, n_eff)
            cur.execute(
                """INSERT INTO channel_stats
                   (channel_id, horizon, n_effective, n_hits, n_push, n_unevaluable,
                    n_buy, n_sell, n_hold, n_absolute, hit_rate, wilson_low, wilson_high,
                    avg_excess_return, excess_std, evaluation_version, updated_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                   ON CONFLICT (channel_id, horizon, evaluation_version) DO UPDATE SET
                       n_effective = EXCLUDED.n_effective,
                       n_hits = EXCLUDED.n_hits,
                       n_push = EXCLUDED.n_push,
                       n_unevaluable = EXCLUDED.n_unevaluable,
                       n_buy = EXCLUDED.n_buy,
                       n_sell = EXCLUDED.n_sell,
                       n_hold = EXCLUDED.n_hold,
                       n_absolute = EXCLUDED.n_absolute,
                       hit_rate = EXCLUDED.hit_rate,
                       wilson_low = EXCLUDED.wilson_low,
                       wilson_high = EXCLUDED.wilson_high,
                       avg_excess_return = EXCLUDED.avg_excess_return,
                       excess_std = EXCLUDED.excess_std,
                       updated_at = NOW()""",
                (channel_id, horizon, n_eff, n_hits, n_push, n_unev,
                 n_buy, n_sell, n_hold, n_absolute,
                 hit_rate, low if n_eff else None, high if n_eff else None,
                 avg_excess, std_excess, EVALUATION_VERSION),
            )

        # channels.hit_rate / trust_score keep feeding existing views; they now
        # carry the 1-month figures under the new definition.
        cur.execute(
            """UPDATE channels c SET
                   hit_rate = cs.hit_rate,
                   trust_score = cs.wilson_low
               FROM channel_stats cs
               WHERE cs.channel_id = c.id
                 AND cs.horizon = '1m'
                 AND cs.evaluation_version = %s
                 AND cs.n_effective >= %s""",
            (EVALUATION_VERSION, MIN_SAMPLE_FOR_RANKING),
        )
        conn.commit()

    logger.info("Updated channel_stats for %d channel/horizon pair(s)", len(rows))
    return len(rows)
