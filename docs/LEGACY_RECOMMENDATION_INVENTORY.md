# Legacy Recommendation Inventory (Step 5 → Step 6)

Audit date: 2026-07-21. Scope: pension/gemel recommendation paths when `three_card_v5` is active (default).

## Decision key

| Action | Meaning |
|--------|---------|
| **remove** | Delete from production path; no remaining consumer |
| **deprecate** | Keep for transition / separate routes; not used by three-card analysis |
| **keep** | Active dependency with documented role |

---

## Finq integration

| Component | Path | Decision | Justification |
|-----------|------|----------|---------------|
| `PensionService.js` | `backend/services/PensionService.js` | **deprecate** | Powers `/api/pension/leading-funds/finq` and `/api/pension/fund/:id` only. Not used by `three_card_v5`. Mark routes deprecated in OpenAPI/README; remove after Step 6 UI drops Finq fund picker. |
| `pensionFinqConfig.js` | `backend/config/pensionFinqConfig.js` | **deprecate** | Config for Finq API; tied to deprecated routes above. |
| `PensionLeadingFundCache` | `backend/models/PensionLeadingFundCache.js` | **deprecate** | Mongo cache for Finq leading funds; same lifecycle as Finq routes. |
| `getLeadingFinqFunds` / `getMarketFundById` | `backend/controllers/pensionController.js` | **deprecate** | Legacy fund-discovery endpoints; PensiaNet/GemelNet market comparison replaces them in advisory flow. |

---

## Static benchmark (legacy pension analysis)

| Component | Path | Decision | Justification |
|-----------|------|----------|---------------|
| `pensionBenchmarkService.js` | `backend/services/pensionBenchmarkService.js` | **deprecate** | `benchmarkPortfolio()` skipped when `three_card_v5` succeeds. Still used if engine disabled (`USE_THREE_CARD_RECOMMENDATIONS=false`) or advisory failure fallback. |
| `pensionBenchmarkTables.js` | `backend/config/pensionBenchmarkTables.js` | **keep** | Static fee/track cohort tables still used by `pensionFundAdvisorService`, `pensionGovDataService`, and legacy benchmark path. Not a recommendation engine — reference data. |
| `pensionHealthCheckService.js` | `backend/services/pensionHealthCheckService.js` | **deprecate** | Health score derived from legacy benchmark; omitted from three-card API. Keep for legacy fallback only. |
| `benchmark` + `healthCheck` response fields | `buildPensionAnalysis` legacy branch | **remove** (from three-card path) | **Done:** not calculated or returned when `recommendationEngine === 'three_card_v5'`. |

---

## PensiaNet / GemelNet (official market data)

| Component | Path | Decision | Justification |
|-----------|------|----------|---------------|
| `marketComparisonService.js` | `backend/services/marketComparison/` | **keep** | Canonical source for PensiaNet/GemelNet peer rankings in three-card market slot. |
| `comparisonContract.js` | `backend/services/marketComparison/comparisonContract.js` | **keep** | Documents combined ranking formula (45/35/20 weights). Project methodology, not raw PensiaNet rank — disclosed in `RANKING_FORMULA_DOC_HE`. |
| `rankingService.js` | `backend/services/marketComparison/rankingService.js` | **keep** | Computes percentile ranks from official return series. |
| `pensionBenchmarkAdvancedService.js` | `backend/services/pensionBenchmarkAdvancedService.js` | **deprecate** | Structured insights for legacy prioritizer (`moreFindings` / advanced analysis). Not attached to three-card canonical payload. |

---

## Gemel legacy comparison

| Component | Path | Decision | Justification |
|-----------|------|----------|---------------|
| `gemelNetAdvisorService.js` | `backend/services/gemelNetAdvisorService.js` | **deprecate** | Legacy `marketAdvice` builder; skipped when three-card gemel analysis succeeds. Still used in legacy gemel branch and `payslipGovBenchmarkService`. |
| `generateGemelRecommendations` | `backend/ai/tools/gemelTools.js` | **deprecate** | Rule-based rec list; superseded by three-card cards on gemel analysis path. |

---

## Prioritizer / insight stack (legacy envelope)

| Component | Path | Decision | Justification |
|-----------|------|----------|---------------|
| `financialInsightPrioritizer.js` | `backend/services/financialAdvisory/` | **deprecate** | Runs inside advisory agent but output hidden when `recommendationCards` present. Cards are single source. |
| `centralRecommendations` / `additionalInsights` | advisory envelope | **remove** (from three-card client payload) | **Done:** not exposed in canonical `buildThreeCardClientPayload`. |
| `moreFindings` | three-card engine internal | **keep** (internal) | Computed for engine completeness; not exposed on canonical API (Step 6 UI uses cards + accountAnalyses). |
| `structuredInsights` | pension/gemel analysis | **remove** (from three-card path) | **Done:** omitted when three-card active. |

---

## Other comparison engines

| Component | Path | Decision | Justification |
|-----------|------|----------|---------------|
| `pensionComparisonEngine.js` | `backend/services/pensionComparisonEngine.js` | **keep** | Used by `/api/pension/compare` product comparison — separate from advisory cards. |
| `pensionFundAdvisorService.js` | `backend/services/pensionFundAdvisorService.js` | **deprecate** | Legacy `fundAdvice`; not in three-card payload. Still on `/api/pension/fund-advice` if mounted. |
| `pensionRecommendationEngine.js` | `backend/services/pensionRecommendationEngine.js` | **keep** | Feeds unified insights into advisory agent (market match metadata). Required upstream of three-card engine. |
| `gemelRecommendationEngine.js` | `backend/services/gemelRecommendationEngine.js` | **keep** | Same role for gemel domain. |
| `pensionClearinghouseInsights.js` | `backend/services/pensionClearinghouseInsights.js` | **keep** | Clearinghouse fee/deposit findings merged into insight pool; high-severity items may surface in `moreFindings` internally. |

---

## Canonical three-card API contract (Step 6)

When `recommendationEngine === 'three_card_v5'`, clients receive:

```
summary, projection?, profile?, productType,
recommendationEngine, analysisId, generatedAt, ruleVersion,
recommendationCards[3], primaryRecommendations, accountAnalyses,
threeCardMeta, marketData, dataQuality, missingData, llm,
disclaimer, productDisclaimer
```

Excluded: `benchmark`, `healthCheck`, `fundAdvice`, `marketAdvice`, `recommendations`, `structuredInsights`, `centralRecommendations`, `additionalInsights`, `insightMeta`, `moreFindings`.

---

## Removal timeline (recommended)

1. **Step 6 UI** — wire cards/accountAnalyses; stop reading legacy fields in frontend.
2. **Step 6.1** — remove Finq routes + cache if UI confirmed unused.
3. **Step 7** — delete legacy benchmark/healthCheck branch after `USE_THREE_CARD_RECOMMENDATIONS=false` support dropped.
