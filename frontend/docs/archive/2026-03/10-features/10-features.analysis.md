# MoneyTech 10-Features Design-Implementation Gap Analysis Report (v2)

> **Summary**: Gap analysis between the design plan (abundant-finding-planet.md) and the actual implementation of 10 investment features.
>
> **Author**: gap-detector
> **Created**: 2026-03-11
> **Last Modified**: 2026-03-11
> **Status**: Draft
> **Previous Version**: v1.0 (2026-03-11) - Overall 73%. Feature 7 was missing, Feature 2 had no UI.

---

## Analysis Overview

- **Analysis Target**: MoneyTech 10 Investment Features
- **Design Document**: `~/.claude/plans/abundant-finding-planet.md`
- **Implementation Path**: `frontend/components/features/`, `frontend/app/`, `frontend/lib/`
- **Analysis Date**: 2026-03-11
- **Delta from v1**: Feature 7 (Portfolio) fully implemented. Feature 2 (Buzz Alert) UI implemented. Feature 3 (Backtest) now has cumulative chart and adjustable amounts. Feature 4 (Consensus Timeline) now has price chart overlay. Feature 9 (Weekly Report) now has ShareButton.

---

## Overall Scores

| Category | Score | Status | Delta from v1 |
|----------|:-----:|:------:|:-------------:|
| Design Match | 84% | CAUTION | +16% |
| Architecture Compliance | 90% | PASS | +12% |
| Convention Compliance | 88% | CAUTION | N/A (new) |
| **Overall** | **87.9%** | **CAUTION** | **+14.9%** |

---

## Per-Feature Score Summary

| # | Feature | v1 Score | v2 Score | Delta | Status |
|:-:|---------|:--------:|:--------:|:-----:|:------:|
| 1 | Contrarian Signal | 88% | 90% | +2% | PASS |
| 2 | Enhanced Buzz Alert | 45% | 82% | +37% | CAUTION |
| 3 | Backtest Simulator | 75% | 88% | +13% | CAUTION |
| 4 | Consensus Timeline | 85% | 92% | +7% | PASS |
| 5 | AI Daily Briefing | 55% | 78% | +23% | CAUTION |
| 6 | Hidden Gems | 82% | 92% | +10% | PASS |
| 7 | YouTuber Portfolio | 0% | 85% | +85% | CAUTION |
| 8 | Risk Scoreboard | 90% | 90% | 0% | PASS |
| 9 | Weekly Report | 78% | 92% | +14% | PASS |
| 10 | Market Gauge | 92% | 90% | -2% | PASS |
| | **Average** | **69%** | **87.9%** | **+18.9%** | **CAUTION** |

---

## Per-Feature Detailed Analysis

### Feature 1: Contrarian Signal (Score: 90%)

**Files**: `components/features/contrarian-signal.tsx`, `lib/queries.ts:getContrarianSignals`

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| Extreme consensus (80%+) detection | Required | Configurable threshold, default 75% on signals page | PASS |
| `predictions` + `asset_prices` cross-analysis | Required | CTE query joining predictions, mentioned_assets, asset_prices | PASS |
| 1-week/1-month return stats after consensus | Required | `historical_avg_return_1w`, `historical_avg_return_1m` | PASS |
| Sell consensus -> rebound probability | Required | Shows average return (not explicit "probability") | PARTIAL |
| Warning display format | Required | 3-level badges (high/medium/low) + % + returns | PASS |
| Type safety | - | `ContrarianSignal` interface fully typed | PASS |

**Gaps**:
- Threshold default is 75% vs design's 80% (minor, configurable).
- "Rebound probability" metric not explicit -- uses average returns instead.

---

### Feature 2: Enhanced Buzz Alert (Score: 82%)

**Files**: `components/features/enhanced-buzz-alert.tsx`, `lib/queries.ts:getEnhancedBuzzAlerts`

**v1 -> v2 changes**: UI component now exists. Growth rate and weighted score displayed.

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| 5+ channels, 24h window | Required | 2+ channels, 48h window | PARTIAL |
| Frequency spike (300%+ growth) | Required | `growth_rate` calculated, displayed as percentage badge | PASS |
| Channel-type weighting | Required | `weighted_score = channel_count*3 + mentions + growth_factor` | PARTIAL |
| Alert delivery (push/email/telegram) | Required | Display only, no push notifications | MISSING |
| Growth badge + weighted score UI | - | Color-coded growth badge + weighted score column | PASS |
| Time-ago display | - | `timeAgo()` helper shows relative time | PASS |

**Gaps**:
- Channel threshold 2+ vs design's 5+ (likely data volume constraint).
- Time window 48h vs 24h.
- Push notifications (web push, email, Telegram) entirely absent.
- Props typed as `any[]` instead of `BuzzAlertEnhanced[]`.

---

### Feature 3: Backtest Simulator (Score: 88%)

**Files**: `components/features/backtest-simulator.tsx`, `app/api/backtest/route.ts`, `lib/queries.ts:getBacktestData`

**v1 -> v2 changes**: Cumulative return chart added. Adjustable investment amount (5 presets). Max drawdown and win rate metrics.

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| Initial amount setting | Required | 5 presets (5M, 10M, 30M, 50M, 100M KRW) | PASS |
| Buy/sell execution per recommendation | Required | Iterates trades with sell-direction negation | PASS |
| Cumulative return chart | Required | `CumulativeReturnChart` SVG component | PASS |
| Benchmark comparison (KOSPI, BTC) | Required | `benchmark_return_pct` exists but hardcoded to 0 | PARTIAL |
| Display format ("Channel: +12.3% vs KOSPI: +5.1%") | Required | Summary text present, benchmark shows 0% | PARTIAL |
| API route | - | `GET /api/backtest?channelId=&amount=` | PASS |
| Max drawdown (MDD) | Not in design | Implemented with display | ADDED |
| Win rate | Not in design | Implemented with display | ADDED |

**Gaps**:
- Benchmark comparison structurally present but always returns 0% (no real KOSPI/BTC data).

---

### Feature 4: Consensus Timeline (Score: 92%)

**Files**: `components/features/consensus-timeline.tsx`, `lib/queries.ts:getConsensusTimeline`, `lib/queries.ts:getAssetPriceHistory`

**v1 -> v2 changes**: Price chart overlay now implemented via `PriceOverlayChart` component.

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| X-axis time, Y-axis YouTuber lanes | Required | Horizontal timeline per channel, dots positioned by date | PASS |
| Color coding (buy=green, hold=yellow, sell=red) | Required | `SENTIMENT_CONFIG` + `PREDICTION_CONFIG` match exactly | PASS |
| Price chart overlay | Required | `PriceOverlayChart` SVG component using `getAssetPriceHistory` | PASS |
| Opinion transition insight | Required | Expandable accordion shows chronological opinion shifts | PASS |
| Interactive expansion | Not in design | Channel rows expand to show individual entries | ADDED |

**Gaps**:
- No dedicated page route; used within asset detail views. Reasonable UX choice.

---

### Feature 5: AI Daily Market Briefing (Score: 78%)

**Files**: `components/features/daily-briefing.tsx`, `app/briefing/page.tsx`, `lib/queries.ts:getDailyBriefingData`

**v1 -> v2 changes**: Market events section added (Section 4). Category temperature display added (Section 5).

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| TOP 5 most mentioned assets | Required | `topMentioned.slice(0, 5)` -- Section 1 | PASS |
| Conflicting opinions | Required | `conflicts` with buy/sell channels -- Section 2 | PASS |
| New recommendations + reasons | Required | `newRecommendations` -- Section 3 | PASS |
| Today's notable events | Required | Derived from temperature extremes + conflicts -- Section 4 | PASS |
| Category temperature | Implied | Grid of per-category temperature cards -- Section 5 | PASS |
| Auto-generation at 7 AM daily | Required | Not implemented (on-demand SSR only) | MISSING |
| Category-specific separate briefings | Required | Single combined view only | PARTIAL |
| Podcast-style audio + text | Required | Text only, no audio/NotebookLM | MISSING |

**Gaps**:
- No audio generation or NotebookLM pipeline integration.
- No scheduled auto-generation (cron job missing).
- Section numbering bug: both Section 4 ("Market Events") and Section 5 ("Category Temperature") display "4." as their number.

---

### Feature 6: Hidden Gems (Score: 92%)

**Files**: `components/features/hidden-gems.tsx`, `app/hidden-gems/page.tsx`, `lib/queries.ts:getHiddenGemChannels`

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| Subscriber < 100K + hit rate > 60% | Required | Filters `subscriber_count < 100000` AND `hit_rate >= 0.6` | PASS |
| Weekly "rising channel" ranking | Required | Approximate: `total_predictions >= 3 && hit_rate >= 0.6` | PARTIAL |
| Radar chart (5 axes) | Required | SVG `RadarChart` with aggressiveness/conservatism/diversity/accuracy/depth | PASS |
| Channel cards with stats | Required | Cards with thumbnail, subscriber count, hit rate, radar | PASS |
| Dedicated page | Required | `/hidden-gems` page | PASS |

**Gaps**:
- "Rising channels" not truly weekly-scoped (no date filtering).
- New channel detection (recently registered, good initial performance) not explicit.

---

### Feature 7: YouTuber Portfolio (Score: 85%)

**Files**: `components/features/youtuber-portfolio.tsx`, `app/api/portfolio/route.ts`, `app/portfolio/page.tsx`

**v1 -> v2 changes**: Entire feature implemented (was 0% in v1).

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| User selects trusted YouTubers | Required | Channel selector with search, checkbox toggle | PASS |
| Custom dashboard with aggregated feed | Required | Combined hit rate + conflicts + recent predictions | PASS |
| Combined historical hit rate | Required | Server-side `combinedHitRate` calculation | PASS |
| "My portfolio hit rate: 64%" | Required | Large percentage display with progress bar | PASS |
| Opinion conflict alerts | Required | Conflict section showing buy vs sell channels | PASS |
| User authentication + persistence | Required | localStorage only, no user auth | PARTIAL |
| Channel limit 3-5 | Required | Up to 10 channels | CHANGED |

**Gaps**:
- No user authentication -- uses `localStorage` for persistence (design specified "user auth + personalized storage").
- Channel limit expanded from "3-5" to 10.
- `portfolioData` uses `any` type extensively instead of a proper response interface.

---

### Feature 8: Risk Scoreboard (Score: 90%)

**Files**: `components/features/risk-scoreboard.tsx`, `lib/queries.ts:getRiskScoreboard`

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| 4-factor composite risk score | Required | consensus + frequency + expert + sentiment | PASS |
| Mention frequency trend | Required | rising/falling/stable vs previous period | PASS |
| High-accuracy channel weighting | Required | `expert_opinion` CTE filters `hit_rate > 0.5` | PASS |
| Sentiment trend detection | Required | improving/worsening/stable | PASS |
| Traffic light (green/yellow/red) | Required | `signal_color` with full config | PASS |
| Score 0-100 display | Required | Colored circle with numeric score | PASS |
| Score breakdown detail | Not in design | 4-component breakdown shown on desktop | ADDED |

**Gaps**:
- Minor: no search/filter for specific asset lookup (embedded in `/signals` page).

---

### Feature 9: Weekly Report (Score: 92%)

**Files**: `components/features/weekly-report.tsx`, `app/weekly-report/page.tsx`, `lib/queries.ts:getWeeklyReport`

**v1 -> v2 changes**: `ShareButton` component added with Web Share API + clipboard fallback.

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| Winner TOP 5 | Required | Grid of RankCard components | PASS |
| Loser TOP 5 (humorous) | Required | Grid with humor disclaimer | PASS |
| Best call of the week | Required | Highlighted card with return % | PASS |
| Worst call of the week | Required | Highlighted card with return % | PASS |
| SNS share card image | Required | `ShareButton` shares text via Web Share API or clipboard | PARTIAL |
| Medal system | Not in design | Gold/Silver/Bronze for top 3 | ADDED |

**Gaps**:
- No actual image card generation for SNS sharing. `ShareButton` shares text-only content. Design specified "auto-generated card image."

---

### Feature 10: Market Sentiment Gauge (Score: 90%)

**Files**: `components/features/market-gauge.tsx`, `lib/queries.ts:getMarketSentimentGauge`

| Aspect | Design Spec | Implementation | Match |
|--------|-------------|----------------|:-----:|
| CNN Fear & Greed style gauge (0-100) | Required | `FearGreedGauge` SVG semicircle with gradient + needle | PASS |
| Per-category temperature | Required | `MiniGauge` per category with progress bars | PASS |
| Historical extremes vs market tops/bottoms | Required | `historical_extremes` from 90-day data | PARTIAL |
| Warning message at extremes | Required | `current_warning` at score >= 80 or <= 20 | PASS |
| Real-time aggregation | Required | 7-day aggregation window (not truly real-time) | PARTIAL |

**Gaps**:
- `actual_market_1m` in historical_extremes is always `null` -- no actual market price comparison.
- 7-day aggregation, not real-time.

---

## Navigation & Routing

All 10 features have navigation entries in `app/layout.tsx`:

| Feature | Route | Nav Label | Status |
|---------|-------|-----------|:------:|
| 1. Contrarian Signal | `/signals` | 시그널 | PASS |
| 2. Buzz Alert | `/signals` | (shared) | PASS |
| 3. Backtest Simulator | `/backtest` | 백테스트 | PASS |
| 4. Consensus Timeline | (embedded in asset pages) | N/A | PASS |
| 5. Daily Briefing | `/briefing` | 브리핑 | PASS |
| 6. Hidden Gems | `/hidden-gems` | 숨은보석 | PASS |
| 7. YouTuber Portfolio | `/portfolio` | 포트폴리오 | PASS |
| 8. Risk Scoreboard | `/signals` | (shared) | PASS |
| 9. Weekly Report | `/weekly-report` | 주간리포트 | PASS |
| 10. Market Gauge | `/signals` | (shared) | PASS |

Features 1, 2, 8, 10 are consolidated on the `/signals` page -- a reasonable UX grouping.

---

## Type System Analysis

| Feature | Type Defined | Component Usage | Query Usage | Consistency |
|---------|:------------:|:--------------:|:-----------:|:-----------:|
| 1. Contrarian Signal | `ContrarianSignal` | Typed | Typed | PASS |
| 2. Buzz Alert | `BuzzAlertEnhanced` | `any[]` props | returns `any[]` | FAIL |
| 3. Backtest | `BacktestResult`, `BacktestTrade` | Typed | Typed | PASS |
| 4. Consensus Timeline | `ConsensusTimelineEntry` | Typed | Typed | PASS |
| 5. Daily Briefing | `DailyBriefing`, `ConflictingAsset` | Typed | Typed | PASS |
| 6. Hidden Gems | `HiddenGemChannel` | Typed | Typed | PASS |
| 7. Portfolio | No response type | `any` throughout | inline SQL | FAIL |
| 8. Risk Score | `RiskScore` | Typed | Typed | PASS |
| 9. Weekly Report | `WeeklyReportItem` | Typed | Typed | PASS |
| 10. Market Gauge | `MarketSentimentGauge` | Typed | Typed | PASS |

---

## Missing Features (Design PRESENT, Implementation ABSENT)

| Item | Design Location | Description | Impact |
|------|-----------------|-------------|:------:|
| Push Notifications | Feature 2, line 30-31 | Web push / email / Telegram bot for buzz alerts | High |
| Audio Briefing | Feature 5, line 63 | Podcast-style audio via NotebookLM pipeline | High |
| Scheduled Generation | Feature 5, line 62 | Auto-generate briefing at 7 AM daily | Medium |
| SNS Card Image | Feature 9, line 114 | Auto-generated image card for social sharing | Medium |
| User Authentication | Feature 7, line 86 | User auth for persistent portfolio storage | Medium |
| Real Benchmark Data | Feature 3, line 41 | Actual KOSPI/BTC benchmark return comparison | Medium |
| Rebound Probability | Feature 1, line 19 | Explicit rebound probability metric for sell consensus | Low |
| Market Price Correlation | Feature 10, line 124 | Historical extreme vs actual market high/low comparison | Low |

## Added Features (Design ABSENT, Implementation PRESENT)

| Item | Location | Description |
|------|----------|-------------|
| Warning Levels | `contrarian-signal.tsx:11` | high/medium/low classification based on consensus % |
| Max Drawdown (MDD) | `backtest-simulator.tsx:147` | Risk metric with display |
| Win Rate | `backtest-simulator.tsx:130` | Trade success rate |
| Interactive Timeline | `consensus-timeline.tsx:148` | Accordion-style channel expansion |
| Market Events Section | `daily-briefing.tsx:162` | Derived events from temperature extremes + conflicts |
| Score Breakdown | `risk-scoreboard.tsx:103` | 4-component detail display for risk scores |
| Medal System | `weekly-report.tsx:25` | Gold/Silver/Bronze for top 3 rankers |
| Amount Presets | `backtest-simulator.tsx:222` | 5 investment amount presets (5M-100M) |

## Changed Features (Design != Implementation)

| Item | Design | Implementation | Impact |
|------|--------|----------------|:------:|
| Buzz channel threshold | 5+ channels | 2+ channels | Low |
| Buzz time window | 24 hours | 48 hours | Low |
| Portfolio channel limit | 3-5 | Up to 10 | Low |
| Contrarian threshold | 80% consensus | 75% default | Low |
| Portfolio storage | User auth + server | localStorage (browser) | Medium |
| Briefing section numbering | 4 sections | 5 sections (Section 4 duplicated) | Low (Bug) |

---

## Known Bugs

| # | Location | Description | Severity |
|:-:|----------|-------------|:--------:|
| 1 | `daily-briefing.tsx:199` | Section "Category Temperature" numbered "4." instead of "5." (duplicates Market Events) | Low |

---

## Recommended Actions

### Immediate (Bug Fix + Type Safety)

1. **Fix section numbering** in `daily-briefing.tsx` line 199: change "4." to "5."
2. **Type-safe Buzz Alert** -- replace `any[]` props in `EnhancedBuzzAlertPanel` with `BuzzAlertEnhanced[]`
3. **Type-safe Portfolio** -- define `PortfolioResponse` type for API response, replace `any` usage
4. **Type-safe query return** for `getEnhancedBuzzAlerts` -- change return type from `any[]` to `BuzzAlertEnhanced[]`

### Medium Priority (Feature Gaps)

5. **Implement real benchmark data** for Backtest Simulator (fetch KOSPI index returns)
6. **Add push notification infrastructure** for Buzz Alerts (browser Notification API as minimum)
7. **Implement scheduled briefing generation** (Vercel Cron or external scheduler at 7 AM)
8. **Add SNS card image generation** for Weekly Report (canvas-based or server-side OG image)
9. **Add actual market price data** to Market Gauge `historical_extremes.actual_market_1m`

### Lower Priority (Enhancement / v2)

10. **User authentication** for portfolio persistence (NextAuth or Supabase Auth)
11. **Audio briefing** via NotebookLM pipeline integration
12. **Per-category separate briefings** for Daily Briefing page
13. **Weekly scope for rising channels** in Hidden Gems (add date filter)
14. **Telegram/email alert channels** for Buzz Alert notifications

### Documentation Updates Needed

- Document threshold changes (buzz: 5->2, contrarian: 80->75, portfolio: 3-5->10)
- Document added features (MDD, win rate, warning levels, medal system, score breakdown)
- Document localStorage as interim portfolio storage solution
- Reflect the `/signals` page consolidation pattern

---

## Post-Analysis Assessment

Given the overall match rate of **87.9%** (>= 70% and < 90%):

> "There are some differences. Document update is recommended."

The implementation has made significant progress since v1 (73% -> 87.9%). The remaining gaps are primarily:
1. **Infrastructure features** (push notifications, audio generation, scheduled jobs) -- these require backend/ops work beyond frontend.
2. **Data integration** (benchmark returns, market price correlation) -- require external data sources.
3. **Type safety** -- two features use `any` types that should be properly typed.

To reach 90%+, the highest-impact actions are items 1-4 (type safety + bug fix) and item 5 (benchmark data).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-11 | Initial gap analysis -- overall 73% (Feature 7 missing) | gap-detector |
| 2.0 | 2026-03-11 | Re-analysis after Feature 7, Buzz UI, Price overlay, ShareButton, Charts | gap-detector |
