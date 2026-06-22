'use strict';

const DOMAIN_LABELS = {
  pension: {
    excellent: 'פנסיה במצב מצוין',
    good: 'פנסיה במצב טוב',
    fair: 'יש מקום לשיפור',
    poor: 'דורש טיפול',
  },
  insurance: {
    excellent: 'כיסוי במצב מצוין',
    good: 'כיסוי במצב טוב',
    fair: 'יש מקום לשיפור',
    poor: 'דורש טיפול',
  },
  financial: {
    excellent: 'מצב פיננסי מצוין',
    good: 'מצב פיננסי טוב',
    fair: 'יש מקום לשיפור',
    poor: 'דורש טיפול',
  },
};

function statusFromRatio(ratio) {
  if (ratio >= 0.85) return 'good';
  if (ratio >= 0.55) return 'warning';
  return 'poor';
}

function getScoreLevel(score, domain = 'financial') {
  const labels = DOMAIN_LABELS[domain] || DOMAIN_LABELS.financial;
  if (score >= 85) return { level: 'excellent', label: labels.excellent };
  if (score >= 70) return { level: 'good', label: labels.good };
  if (score >= 50) return { level: 'fair', label: labels.fair };
  return { level: 'poor', label: labels.poor };
}

function buildHealthCheckResult(categories, disclaimer, domain) {
  const totalScore = categories.reduce((sum, cat) => sum + (cat.score || 0), 0);
  const score = Math.min(100, totalScore);
  return {
    score,
    level: getScoreLevel(score, domain),
    categories,
    disclaimer,
  };
}

module.exports = {
  statusFromRatio,
  getScoreLevel,
  buildHealthCheckResult,
  DOMAIN_LABELS,
};
