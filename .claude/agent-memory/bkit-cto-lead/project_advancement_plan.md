---
name: MoneyTech Advancement Plan
description: Comprehensive codebase analysis and advancement roadmap created 2026-03-20. Covers 6 phases from tech debt to monetization.
type: project
---

## Key Findings (2026-03-20)

### Critical Issues
1. queries.ts is 1465 lines - needs splitting into domain modules
2. NLP uses keyword matching only - needs LLM upgrade
3. No DB connection pooling in crawler
4. NLP pipeline duplicated across 4 crawlers
5. Zero test coverage
6. No caching (force-dynamic on all pages)

### Advancement Phases
- Phase 1: Tech debt (queries split, NLP consolidation, DB pool, error handling)
- Phase 2: NLP upgrade (LLM-based analysis, asset dictionary DB)
- Phase 3: Performance (caching, materialized views, ISR)
- Phase 4: UX (auth, real-time alerts, mobile, personalization)
- Phase 5: New features (AI chatbot, cross-platform conflict detection, prediction tracker)
- Phase 6: Monetization (freemium, B2B API)

### Plan Document
`docs/01-plan/features/moneytech-advancement.plan.md`
