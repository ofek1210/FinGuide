'use strict';

/**
 * Shared configuration for pension / gemel / hishtalmut advisory flows.
 */

module.exports = {
  ruleVersion: '1.0.0',

  /** Days after which market snapshot is considered stale */
  marketDataStaleDays: Number(process.env.ADVISORY_MARKET_STALE_DAYS) || 45,

  matchConfidence: {
    strongMin: 90,
    acceptableMin: 70,
    weakMin: 50,
    /** Below this — no peer ranking recommendations */
    peerRankingMin: 70,
  },

  severityOrder: {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  },

  categoryPriority: {
    data_quality: 0,
    deposits: 1,
    coverage: 2,
    risk: 3,
    fees: 4,
    performance: 5,
    account_structure: 6,
    liquidity: 7,
  },

  disclaimers: {
    general:
      'המידע נועד להנגשה ולסיוע בבדיקת הנתונים ואינו תחליף לייעוץ פנסיוני או פיננסי אישי.',
    pension:
      'המידע אינו מהווה ייעוץ פנסיוני או המלצה לביצוע פעולה. יש להתייעץ עם בעל רישיון לפני שינוי מסלול, איחוד קרנות או שינוי כיסוי ביטוחי.',
    gemel:
      'המידע מבוסס על נתוני גמל-נט ואינו מהווה ייעוץ פנסיוני או המלצה לביצוע פעולה.',
  },

  llm: {
    timeoutMs: Number(process.env.ADVISORY_LLM_TIMEOUT_MS) || 25000,
    maxTokens: 1200,
    temperature: 0.2,
    maxWordsPerRecommendation: 45,
  },

  /** Merge insights sharing same dedupe key */
  dedupeKeyFields: ['code', 'productId', 'category'],

  /** Small inactive gemel/hishtalmut balance (ILS) */
  smallInactiveBalanceThreshold: Number(process.env.GEMEL_SMALL_INACTIVE_THRESHOLD) || 3000,
};
