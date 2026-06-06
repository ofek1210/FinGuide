/**
 * Investment Recommender — risk-profile-aware, personalized allocations.
 * No external data; uses rules calibrated to Israeli 2026 market context.
 */

// ── Allocation blueprints ─────────────────────────────────────────────────────

const ALLOCATIONS = {
  low: {
    label: 'שמרני',
    description: 'מתאים לאנשים שמעדיפים יציבות על פני תשואה גבוהה',
    allocation: [
      { asset: 'government_bonds', label: 'אג״ח ממשלתי', pct: 45, color: '#00FFD0' },
      { asset: 'corporate_bonds', label: 'אג״ח קונצרני', pct: 25, color: '#5A26FF' },
      { asset: 'stocks_il', label: 'מניות ישראל', pct: 10, color: '#FAFF00' },
      { asset: 'stocks_global', label: 'מניות גלובליות', pct: 10, color: '#FF00A8' },
      { asset: 'cash_deposits', label: 'פיקדונות / נזילות', pct: 10, color: '#999' },
    ],
    expectedAnnualReturn: { min: 3, max: 6 },
    riskLevel: 'נמוך',
    horizon: 'קצר-בינוני (3-7 שנים)',
  },
  medium: {
    label: 'מאוזן',
    description: 'איזון בין צמיחה לביטחון — מתאים לרוב המשקיעים',
    allocation: [
      { asset: 'stocks_global', label: 'מניות גלובליות', pct: 35, color: '#FAFF00' },
      { asset: 'stocks_il', label: 'מניות ישראל', pct: 20, color: '#FF00A8' },
      { asset: 'government_bonds', label: 'אג״ח ממשלתי', pct: 20, color: '#00FFD0' },
      { asset: 'corporate_bonds', label: 'אג״ח קונצרני', pct: 15, color: '#5A26FF' },
      { asset: 'real_estate_fund', label: 'קרן נדל״ן (REIT)', pct: 10, color: '#888' },
    ],
    expectedAnnualReturn: { min: 5, max: 10 },
    riskLevel: 'בינוני',
    horizon: 'בינוני-ארוך (7-15 שנים)',
  },
  high: {
    label: 'אגרסיבי',
    description: 'מקסום צמיחה לטווח ארוך — מתאים לצעירים עם אורך נשימה',
    allocation: [
      { asset: 'stocks_global', label: 'מניות גלובליות (ETF)', pct: 45, color: '#FAFF00' },
      { asset: 'stocks_il', label: 'מניות ישראל', pct: 20, color: '#FF00A8' },
      { asset: 'emerging_markets', label: 'שווקים מתעוררים', pct: 15, color: '#5A26FF' },
      { asset: 'real_estate_fund', label: 'קרן נדל״ן (REIT)', pct: 10, color: '#00FFD0' },
      { asset: 'crypto', label: 'קריפטו (מגוון)', pct: 10, color: '#f80' },
    ],
    expectedAnnualReturn: { min: 8, max: 18 },
    riskLevel: 'גבוה',
    horizon: 'ארוך (15+ שנים)',
  },
};

// ── Specific product suggestions per risk + profile ───────────────────────────

function getProductSuggestions(riskTolerance, { age, hasPension, hasStudyFund, grossSalary } = {}) {
  const suggestions = [];
  const risk = riskTolerance || 'medium';

  // Universal
  suggestions.push({
    category: 'pension',
    title: 'הגדלת הפרשה לפנסיה',
    description: 'אם שיעור ההפרשה שלך נמוך מ-7%, שקול להגדיל — כל אחוז נוסף חוסך מס ובונה עתיד.',
    priority: 'high',
    taxBenefit: true,
  });

  if (!hasStudyFund) {
    suggestions.push({
      category: 'study_fund',
      title: 'פתיחת קרן השתלמות',
      description: 'קרן השתלמות היא אחד הכלים הטובים בישראל — פטורה ממס רווח הון עד תקרה ונזילה אחרי 6 שנים.',
      priority: 'high',
      taxBenefit: true,
    });
  }

  if (risk === 'low') {
    suggestions.push({
      category: 'deposit',
      title: 'פיקדון צמוד מדד / שקלי',
      description: 'ריבית של 4-5% בבנק לתקופות של 6-36 חודשים — נזיל ובטוח.',
      priority: 'medium',
    });
    suggestions.push({
      category: 'bonds',
      title: 'אג״ח ממשלתי צמוד מדד (גליל)',
      description: 'הגנה מאינפלציה עם תשואה ריאלית של 1.5-3%.',
      priority: 'medium',
    });
  }

  if (risk === 'medium') {
    suggestions.push({
      category: 'etf',
      title: 'קרן מחקה S&P 500',
      description: 'חשיפה לשוק האמריקאי בעלויות נמוכות (דמי ניהול 0.1-0.3%). מתאים כחלק מהתיק.',
      priority: 'medium',
    });
    suggestions.push({
      category: 'reit',
      title: 'קרן נדל״ן (REIT) גלובלית',
      description: 'חשיפה לנדל״ן ללא קנייה ישירה — תשואת דיבידנד ממוצעת 3-5%.',
      priority: 'low',
    });
  }

  if (risk === 'high') {
    suggestions.push({
      category: 'etf',
      title: 'ETF שווקים מתעוררים (MSCI EM)',
      description: 'פוטנציאל צמיחה גבוה מסין, הודו וברזיל — עם סיכון גבוה יותר.',
      priority: 'medium',
    });
    if (age && age < 40) {
      suggestions.push({
        category: 'crypto',
        title: 'הקצאה קטנה לקריפטו (Bitcoin/Ethereum)',
        description: 'עד 5-10% מהתיק בנכסים דיגיטליים — רק אם יש אורך נשימה.',
        priority: 'low',
      });
    }
    suggestions.push({
      category: 'etf',
      title: 'קרן מחקה NASDAQ 100',
      description: 'חשיפה לטכנולוגיה — תנודתי אך עם תשואה היסטורית גבוהה.',
      priority: 'medium',
    });
  }

  return suggestions;
}

// ── Projected wealth calculator ───────────────────────────────────────────────

function projectWealth({ monthlyInvestment, currentSavings = 0, years = 20, annualReturnPct }) {
  const r = annualReturnPct / 100 / 12;
  const n = years * 12;
  const fv = currentSavings * Math.pow(1 + r, n) +
    monthlyInvestment * ((Math.pow(1 + r, n) - 1) / r);
  return Math.round(fv);
}

// ── Main function ─────────────────────────────────────────────────────────────

function buildInvestmentRecommendations(profile, { grossSalary, netSalary } = {}) {
  const risk = profile?.financial?.riskTolerance || 'medium';
  const age = profile?.personal?.age;
  const hasPension = profile?.retirement?.hasPension;
  const hasStudyFund = profile?.retirement?.hasStudyFund;
  const savings = profile?.financial?.savingsEstimate || 0;
  const expenses = profile?.financial?.monthlyExpensesEstimate || 0;
  const debts = profile?.financial?.monthlyDebts || 0;
  const net = netSalary || 0;

  const blueprint = ALLOCATIONS[risk] || ALLOCATIONS.medium;
  const suggestions = getProductSuggestions(risk, { age, hasPension, hasStudyFund, grossSalary });

  // Recommended monthly investment amount
  const disposable = Math.max(0, net - expenses - debts);
  const recommendedMonthlyInvestment = Math.round(disposable * 0.3); // 30% of disposable

  // Projections
  const midReturn = (blueprint.expectedAnnualReturn.min + blueprint.expectedAnnualReturn.max) / 2;
  const projections = [5, 10, 20].map(years => ({
    years,
    projected: recommendedMonthlyInvestment > 0
      ? projectWealth({ monthlyInvestment: recommendedMonthlyInvestment, currentSavings: savings, years, annualReturnPct: midReturn })
      : null,
  }));

  return {
    riskProfile: risk,
    riskLabel: blueprint.label,
    riskDescription: blueprint.description,
    allocation: blueprint.allocation,
    expectedAnnualReturn: `${blueprint.expectedAnnualReturn.min}%–${blueprint.expectedAnnualReturn.max}%`,
    horizon: blueprint.horizon,
    riskLevel: blueprint.riskLevel,
    suggestions,
    disposableMonthly: disposable,
    recommendedMonthlyInvestment,
    projections,
  };
}

module.exports = { buildInvestmentRecommendations, ALLOCATIONS };
