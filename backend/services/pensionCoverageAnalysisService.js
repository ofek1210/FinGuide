'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const config = require('../config/pensionAnalysisConfig');

function normalizeCoverageType(type) {
  return String(type || '').toLowerCase();
}

function hasSurvivorCoverage(coverages) {
  return (coverages || []).some(c =>
    config.survivorCoverageTypes.some(kw => normalizeCoverageType(c.coverageType).includes(kw.toLowerCase())),
  );
}

function hasDisabilityCoverage(coverages) {
  return (coverages || []).some(c =>
    config.disabilityCoverageTypes.some(kw => normalizeCoverageType(c.coverageType).includes(kw.toLowerCase())),
  );
}

function maritalStatusLabel(status) {
  const map = {
    single: 'רווק/ה',
    married: 'נשוי/אה',
    partnered: 'ידוע/ה בציבור',
    divorced: 'גרוש/ה',
    widowed: 'אלמן/ה',
  };
  return map[status] || status;
}

/**
 * Deliverables #11 + #12 — insurance coverage + survivor fit vs family status.
 */
function analyzeCoverage(funds, userContext) {
  const insights = [];
  const marital = userContext?.personal?.maritalStatus;
  const children = userContext?.personal?.childrenCount ?? 0;

  for (const fund of funds || []) {
    const coverages = fund.insuranceCoverages || [];
    if (!coverages.length) continue;

    const hasSurvivor = hasSurvivorCoverage(coverages);
    const hasDisability = hasDisabilityCoverage(coverages);

    if (!hasDisability) {
      insights.push(buildPensionInsight({
        category: 'insurance_coverage',
        severity: 'low',
        title: `כיסוי נכות — ${fund.fundName}`,
        finding: 'לא זוהה כיסוי נכות בדוח — ייתכן שהמידע חסר או שהכיסוי במקום אחר.',
        personalDataUsed: ['fund.insuranceCoverages'],
        marketDataUsed: [],
        recommendedAction: 'מומלץ לבדוק עם בעל רישיון את כיסוי הנכות והשארים.',
        confidence: 0.5,
        limitations: ['תלוי בשלמות גיליון הכיסויים בדוח'],
        fundId: fund._id?.toString?.() || fund.id,
        legacyType: 'disability_coverage_check',
      }));
    }

    if (marital === 'single' && children === 0 && hasSurvivor) {
      insights.push(buildPensionInsight({
        category: 'survivor_coverage_fit',
        severity: 'medium',
        title: 'ייתכן שכיסוי השארים אינו מתאים למצבך המשפחתי',
        finding: `לפי נתוני האונבורדינג את/ה ${maritalStatusLabel(marital)} ללא ילדים, `
          + `אך בקרן "${fund.fundName}" קיים כיסוי שארים.`,
        personalDataUsed: ['profile.personal.maritalStatus', 'profile.personal.childrenCount', 'fund.insuranceCoverages'],
        marketDataUsed: [],
        recommendedAction: 'מומלץ לבדוק האם הכיסוי עדיין נחוץ או שניתן להתאימו למצבך המשפחתי, לאחר התייעצות עם בעל רישיון פנסיוני.',
        confidence: 0.8,
        requiresLicensedAdvisor: true,
        fundId: fund._id?.toString?.() || fund.id,
        legacyType: 'survivor_coverage_mismatch_single',
      }));
    }

    if ((marital === 'married' || marital === 'partnered') && !hasSurvivor) {
      insights.push(buildPensionInsight({
        category: 'survivor_coverage_fit',
        severity: 'medium',
        title: 'כיסוי שארים — מומלץ לבדוק',
        finding: `${maritalStatusLabel(marital)} ללא כיסוי שארים מזוהה בקרן "${fund.fundName}".`,
        personalDataUsed: ['profile.personal.maritalStatus', 'fund.insuranceCoverages'],
        marketDataUsed: [],
        recommendedAction: 'מומלץ לבדוק עם בעל רישיון האם כיסוי השארים מתאים לצרכים המשפחתיים.',
        confidence: 0.75,
        requiresLicensedAdvisor: true,
        fundId: fund._id?.toString?.() || fund.id,
        legacyType: 'survivor_coverage_missing',
      }));
    }

    if (children > 0 && hasSurvivor) {
      const survivorCov = coverages.find(c =>
        config.survivorCoverageTypes.some(kw => normalizeCoverageType(c.coverageType).includes(kw.toLowerCase())),
      );
      const monthly = survivorCov?.monthlyPension;
      if (monthly != null && monthly > 0 && monthly < 2000) {
        insights.push(buildPensionInsight({
          category: 'survivor_coverage_fit',
          severity: 'medium',
          title: 'כיסוי שארים — ייתכן שכדאי לבדוק',
          finding: `יש ${children} ילד/ים וכיסוי שארים חודשי של ₪${monthly.toLocaleString('he-IL')} — ייתכן שכדאי לבחון התאמה.`,
          personalDataUsed: ['profile.personal.childrenCount', 'fund.insuranceCoverages'],
          marketDataUsed: [],
          recommendedAction: 'מומלץ לבדוק עם בעל רישיון את התאמת כיסוי השארים למצב המשפחתי.',
          confidence: 0.65,
          requiresLicensedAdvisor: true,
          fundId: fund._id?.toString?.() || fund.id,
          legacyType: 'survivor_coverage_low',
        }));
      }
    }
  }

  return insights;
}

module.exports = { analyzeCoverage, hasSurvivorCoverage, hasDisabilityCoverage };
