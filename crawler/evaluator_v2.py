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

from psycopg2.extras import execute_values

from logger import logger
from price_history import (
    MAX_DATE_SLACK_DAYS,
    asof_from_index,
    load_benchmark_index,
    load_price_index,
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
        listing = (market or "").upper()
        if listing == "KOSDAQ":
            return "KOSDAQ"
        if listing == "NASDAQ":
            return "NASDAQ"
        if listing == "NYSE":
            return "SP500"
        if listing == "KOSPI":
            return "KOSPI"
        # Market unknown. Only a six-digit code is certainly a Korean listing;
        # anything else gets an absolute verdict rather than being measured
        # against KOSPI, which is how 32 US tickers were scored against a
        # Korean index for months (G41).
        code = asset_code or ""
        if code.isdigit() and len(code) == 6:
            return "KOSPI"
        return None
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
    rows = cur.fetchall()

    # asset_dictionary is unique on (asset_name, asset_type), not on
    # asset_code, so an alias stored as its own row would multiply a
    # prediction across the join. Callers batch these rows into a single
    # upsert, where a repeated key is a hard error, so the invariant of one
    # row per prediction is enforced here rather than assumed.
    seen = set()
    unique_rows = []
    for row in rows:
        if row[0] in seen:
            continue
        seen.add(row[0])
        unique_rows.append(row)
    if len(unique_rows) != len(rows):
        logger.warning(
            "Dropped %d duplicate pending row(s) — check asset_dictionary for repeated asset_code",
            len(rows) - len(unique_rows),
        )
    return unique_rows


def _existing_horizons_bulk(cur, prediction_ids: list) -> dict:
    """Already-scored horizons for every pending prediction, in one statement."""
    if not prediction_ids:
        return {}
    cur.execute(
        # psycopg2 hands UUID columns back as str, so the array needs an
        # explicit cast to match the uuid column type.
        """SELECT prediction_id, horizon FROM prediction_evaluations
           WHERE evaluation_version = %s AND prediction_id = ANY(%s::uuid[])""",
        (EVALUATION_VERSION, [str(pid) for pid in prediction_ids]),
    )
    done: dict = {}
    for prediction_id, horizon in cur.fetchall():
        done.setdefault(prediction_id, set()).add(horizon)
    return done


_RECORD_COLUMNS = (
    "prediction_id", "horizon", "eval_date", "price_t0", "price_th",
    "asset_return", "benchmark_code", "benchmark_return", "excess_return",
    "outcome", "unevaluable_reason", "evaluation_version",
)


def _pending_record(prediction_id, horizon: str, **fields) -> tuple:
    """One evaluation row, buffered until the next flush."""
    return (
        prediction_id, horizon, fields.get("eval_date"),
        fields.get("price_t0"), fields.get("price_th"), fields.get("asset_return"),
        fields.get("benchmark_code"), fields.get("benchmark_return"),
        fields.get("excess_return"), fields["outcome"],
        fields.get("unevaluable_reason"), EVALUATION_VERSION,
    )


def _flush(cur, records: list[tuple], processed_ids: list) -> None:
    """Write one batch of evaluations and mark their predictions evaluated."""
    if records:
        execute_values(
            cur,
            f"""INSERT INTO prediction_evaluations ({", ".join(_RECORD_COLUMNS)})
               VALUES %s
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
            records,
        )

    if processed_ids:
        # Reads the rows just inserted above, so a prediction scored in this
        # batch is marked here rather than waiting for the next run.
        cur.execute(
            """UPDATE predictions p SET evaluation_status = 'evaluated'
               WHERE p.id = ANY(%s::uuid[])
                 AND p.evaluation_status IS DISTINCT FROM 'evaluated'
                 AND EXISTS (SELECT 1 FROM prediction_evaluations pe
                             WHERE pe.prediction_id = p.id
                               AND pe.evaluation_version = %s
                               AND pe.outcome IN ('hit','miss','push'))""",
            ([str(pid) for pid in processed_ids], EVALUATION_VERSION),
        )


def requeue_stale_benchmarks(conn) -> int:
    """Reopen verdicts scored against a benchmark that is no longer the right one.

    The benchmark is derived from asset_dictionary.market, which arrives late
    (backfill_market) and can change (a KOSDAQ listing transfers to KOSPI).
    A verdict computed under the old mapping never re-derives itself — the row
    exists, so _fetch_pending skips the prediction forever. Deleting the
    mismatched rows is what makes the mapping correction take effect.

    The CASE below must mirror resolve_benchmark(); only settled verdicts are
    touched, since unevaluable rows carry no benchmark to compare against.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM prediction_evaluations
            WHERE id IN (
                SELECT pe.id
                FROM prediction_evaluations pe
                JOIN predictions p ON p.id = pe.prediction_id
                JOIN mentioned_assets ma ON ma.id = p.mentioned_asset_id
                LEFT JOIN asset_dictionary ad ON ad.asset_code = ma.asset_code
                WHERE pe.evaluation_version = %s
                  AND pe.outcome IN ('hit', 'miss', 'push')
                  AND pe.benchmark_code IS DISTINCT FROM (
                      CASE
                          WHEN ma.asset_type = 'stock' THEN
                              CASE upper(COALESCE(ad.market, ''))
                                  WHEN 'KOSDAQ' THEN 'KOSDAQ'
                                  WHEN 'NASDAQ' THEN 'NASDAQ'
                                  WHEN 'NYSE' THEN 'SP500'
                                  WHEN 'KOSPI' THEN 'KOSPI'
                                  ELSE CASE WHEN ma.asset_code ~ '^[0-9]{6}$'
                                            THEN 'KOSPI' ELSE NULL END
                              END
                          WHEN ma.asset_type = 'coin'
                               AND upper(ma.asset_code) = 'BTC' THEN NULL
                          WHEN ma.asset_type = 'coin' THEN 'BTC'
                          ELSE NULL
                      END
                  )
            )
            """,
            (EVALUATION_VERSION,),
        )
        reopened = cur.rowcount
        conn.commit()

    logger.info("Requeued %d verdict(s) with a stale benchmark", reopened)
    return reopened


def requeue_unevaluable(conn) -> int:
    """Reopen unevaluable verdicts whose missing price has since arrived.

    "unevaluable" is recorded when no price exists for t0 (or the horizon
    date). Without this step that verdict is a ratchet: _fetch_pending's
    NOT EXISTS treats the row as done, so even after a backfill loads the
    price the prediction is never scored. Deleting the row is safe — it holds
    no information beyond "price was missing at the time", and the evaluator
    recomputes it on the next pass.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM prediction_evaluations pe
            USING predictions p, mentioned_assets ma
            WHERE pe.prediction_id = p.id
              AND p.mentioned_asset_id = ma.id
              AND pe.evaluation_version = %s
              AND pe.outcome = 'unevaluable'
              AND pe.unevaluable_reason = 'no_price_at_t0'
              AND EXISTS (
                  SELECT 1 FROM asset_prices ap
                  WHERE ap.asset_code = ma.asset_code
                    AND ap.recorded_date <= p.predicted_at::date
                    AND ap.recorded_date >= p.predicted_at::date - %s
              )
            """,
            (EVALUATION_VERSION, MAX_DATE_SLACK_DAYS),
        )
        reopened_t0 = cur.rowcount

        cur.execute(
            """
            DELETE FROM prediction_evaluations pe
            USING predictions p, mentioned_assets ma
            WHERE pe.prediction_id = p.id
              AND p.mentioned_asset_id = ma.id
              AND pe.evaluation_version = %s
              AND pe.outcome = 'unevaluable'
              AND pe.unevaluable_reason = 'no_price_at_horizon'
              AND EXISTS (
                  SELECT 1 FROM asset_prices ap
                  WHERE ap.asset_code = ma.asset_code
                    AND ap.recorded_date <= p.predicted_at::date
                        + CASE pe.horizon WHEN '1w' THEN 7 WHEN '1m' THEN 30 ELSE 90 END
                    AND ap.recorded_date >= p.predicted_at::date
                        + CASE pe.horizon WHEN '1w' THEN 7 WHEN '1m' THEN 30 ELSE 90 END - %s
              )
            """,
            (EVALUATION_VERSION, MAX_DATE_SLACK_DAYS),
        )
        reopened_h = cur.rowcount
        conn.commit()

    total = reopened_t0 + reopened_h
    logger.info(
        "Requeued %d unevaluable verdict(s) (%d t0, %d horizon)",
        total, reopened_t0, reopened_h,
    )
    return total


def evaluate_predictions(conn, limit: int | None = None) -> dict[str, int]:
    """Score every prediction whose horizons have come due."""
    counts = {"hit": 0, "miss": 0, "push": 0, "unevaluable": 0, "not_due": 0}
    today = today_kst()

    with conn.cursor() as cur:
        pending = _fetch_pending(cur, limit)
        logger.info("Evaluating %d prediction(s)", len(pending))
        if not pending:
            return counts

        # Three statements up front instead of a dozen per prediction. Scoring
        # needs only a handful of as-of prices each, but issuing them one at a
        # time against a remote database made the job latency-bound: it spent
        # ~0.5s per prediction and never finished inside the CI timeout. The
        # whole price history is a few megabytes.
        done_by_prediction = _existing_horizons_bulk(cur, [row[0] for row in pending])
        prices = load_price_index(cur, sorted({row[4] for row in pending if row[4]}))
        benchmarks = load_benchmark_index(cur)

        records: list[tuple] = []
        batch_ids: list = []

        for processed, (pred_id, ptype, t0, channel_id, asset_code,
                        asset_type, market, is_delisted, target_price) in enumerate(pending, 1):
            if t0 is None:
                continue

            done = done_by_prediction.get(pred_id, set())
            benchmark_code = resolve_benchmark(asset_type, market, asset_code)
            base = asof_from_index(prices.get(asset_code), t0)
            batch_ids.append(pred_id)

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
                    records.append(_pending_record(pred_id, horizon, outcome="unevaluable",
                                                  unevaluable_reason="no_price_at_t0"))
                    counts["unevaluable"] += 1
                    continue

                # The date the price actually came from, not the nominal t0.
                # Both ends must be read on the same session or the excess
                # picks up a day of index movement that no one predicted —
                # KOSPI moved -17.2% and +17.9% on consecutive days in this
                # very sample, so a one-session slip is worth more than most
                # calls (G42).
                price_t0, base_date = base

                if is_delisted:
                    # Treated as a resolved outcome: a delisted holding is the
                    # worst case for a buy call and the best case for a sell.
                    outcome = "miss" if ptype == "buy" else "hit" if ptype == "sell" else "miss"
                    records.append(_pending_record(
                        pred_id, horizon, eval_date=target, price_t0=price_t0,
                        price_th=0, asset_return=-1.0, benchmark_code=benchmark_code,
                        excess_return=-1.0, outcome=outcome,
                        unevaluable_reason="delisted"))
                    counts[outcome] += 1
                    continue

                later = asof_from_index(prices.get(asset_code), target)
                if later is None:
                    records.append(_pending_record(pred_id, horizon, outcome="unevaluable",
                                                  unevaluable_reason="no_price_at_horizon"))
                    counts["unevaluable"] += 1
                    continue

                price_th, eval_date = later
                if price_t0 <= 0:
                    records.append(_pending_record(pred_id, horizon, outcome="unevaluable",
                                                  unevaluable_reason="invalid_base_price"))
                    counts["unevaluable"] += 1
                    continue

                asset_return = price_th / price_t0 - 1

                benchmark_return = None
                band = BANDS[horizon]
                if benchmark_code:
                    b0 = asof_from_index(benchmarks.get(benchmark_code), base_date)
                    bh = asof_from_index(benchmarks.get(benchmark_code), eval_date)
                    if b0 and bh and b0[0] > 0:
                        benchmark_return = bh[0] / b0[0] - 1
                    else:
                        benchmark_code = None

                if benchmark_return is None:
                    band *= ABSOLUTE_BAND_MULTIPLIER

                excess = asset_return - (benchmark_return or 0.0)
                outcome = classify(ptype, excess, band)

                records.append(_pending_record(
                    pred_id, horizon, eval_date=eval_date, price_t0=price_t0,
                    price_th=price_th, asset_return=asset_return,
                    benchmark_code=benchmark_code, benchmark_return=benchmark_return,
                    excess_return=excess, outcome=outcome))
                counts[outcome] += 1

            if processed % COMMIT_EVERY == 0:
                _flush(cur, records, batch_ids)
                conn.commit()
                records, batch_ids = [], []
                logger.info("  evaluated %d/%d", processed, len(pending))

        _flush(cur, records, batch_ids)
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

        stats = []
        for (channel_id, horizon, n_eff, n_hits, n_push, n_unev,
             n_buy, n_sell, n_hold, n_absolute, avg_excess, std_excess) in rows:
            hit_rate = (n_hits / n_eff) if n_eff else None
            low, high = wilson_interval(n_hits, n_eff)
            stats.append((
                channel_id, horizon, n_eff, n_hits, n_push, n_unev,
                n_buy, n_sell, n_hold, n_absolute,
                hit_rate, low if n_eff else None, high if n_eff else None,
                avg_excess, std_excess, EVALUATION_VERSION,
            ))

        if stats:
            # One statement rather than one per channel/horizon pair, for the
            # same latency reason as the evaluation loop above.
            execute_values(
                cur,
                """INSERT INTO channel_stats
                   (channel_id, horizon, n_effective, n_hits, n_push, n_unevaluable,
                    n_buy, n_sell, n_hold, n_absolute, hit_rate, wilson_low, wilson_high,
                    avg_excess_return, excess_std, evaluation_version)
                   VALUES %s
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
                stats,
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
