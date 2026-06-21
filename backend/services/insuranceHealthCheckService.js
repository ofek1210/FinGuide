/**
 * Insurance health score — duplicates, gaps, coverage breadth.
 */
'use strict';

const { buildHealthCheckResult } = require('../utils/healthScoreShared');

function runInsuranceHealthCheck(profileDTO, analysis) {
  const categories = [];
  let totalScore = 0;

  const policyCount = profileDTO.policies?.length ?? 0;
  let coverageScore = 0;
  if (policyCount >= 3) coverageScore = 25;
  else if (policyCount >= 1) coverageScore = 15;
  categories.push({
    id: 'coverage',
    label: 'רוחב כיסוי',
    score: coverageScore,
    maxScore: 25,
    status: coverageScore >= 20 ? 'good' : coverageScore >= 10 ? 'warning' : 'poor',
    detail: policyCount ? `${policyCount} פוליסות פעילות` : 'לא יובאו פוליסות',
  });
  totalScore += coverageScore;

  const dupCount = analysis.duplicateCount ?? 0;
  let dupScore = dupCount === 0 ? 25 : dupCount === 1 ? 15 : 5;
  categories.push({
    id: 'duplicates',
    label: 'כפילויות',
    score: dupScore,
    maxScore: 25,
    status: dupCount === 0 ? 'good' : dupCount === 1 ? 'warning' : 'poor',
    detail: dupCount ? `${dupCount} סוגי כיסוי כפולים` : 'לא זוהו כפילויות',
  });
  totalScore += dupScore;

  const missing = analysis.missingCoverage?.length ?? 0;
  let gapScore = missing === 0 ? 25 : missing <= 2 ? 15 : 5;
  categories.push({
    id: 'gaps',
    label: 'פערים בכיסוי',
    score: gapScore,
    maxScore: 25,
    status: missing === 0 ? 'good' : missing <= 2 ? 'warning' : 'poor',
    detail: missing ? `${missing} כיסויים חסרים לפי הפרופיל` : 'אין פערים קריטיים',
  });
  totalScore += gapScore;

  const waste = analysis.totalMonthlyWaste ?? 0;
  let wasteScore = waste === 0 ? 25 : waste < 200 ? 15 : 5;
  categories.push({
    id: 'waste',
    label: 'בזבוז פרמיות',
    score: wasteScore,
    maxScore: 25,
    status: waste === 0 ? 'good' : waste < 200 ? 'warning' : 'poor',
    detail: waste > 0 ? `~₪${Math.round(waste)}/חודש בכפילויות` : 'אין בזבוז מזוהה',
  });
  totalScore += wasteScore;

  return buildHealthCheckResult(
    categories,
    'הציון מבוסס על ייבוא הר הביטוח והפרופיל — אינו ייעוץ ביטוחי.',
    'insurance',
  );
}

module.exports = { runInsuranceHealthCheck };
