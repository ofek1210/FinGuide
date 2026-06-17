/**
 * Budget Analysis Service
 * Analyzes income vs expenses vs savings ratio and produces actionable insights.
 * Follows the 50/30/20 rule adapted for Israeli context.
 */

const BUDGET_BENCHMARKS = {
  // Ideal allocation of net income
  needs: 0.50,         // housing, food, transport, utilities
  wants: 0.30,         // entertainment, dining, hobbies
  savings: 0.20,       // savings + investments + emergency fund
  emergencyFundMonths: 3, // minimum emergency fund = 3 months expenses
};

function classifyBudgetHealth(savingsRatio) {
  if (savingsRatio >= 0.25) return { status: 'excellent', label: 'מצוין', color: '#00FFD0' };
  if (savingsRatio >= 0.15) return { status: 'good', label: 'טוב', color: '#FAFF00' };
  if (savingsRatio >= 0.05) return { status: 'warning', label: 'יש מקום לשיפור', color: '#f80' };
  return { status: 'poor', label: 'דורש טיפול', color: '#FF00A8' };
}

function buildSpendingBreakdown(netSalary, expenses, debts, mortgage) {
  const totalFixed = (debts || 0) + (mortgage || 0);
  const discretionary = Math.max(0, (expenses || 0) - totalFixed);
  const saved = Math.max(0, netSalary - (expenses || 0));
  const total = netSalary || 1;

  return {
    fixed: { amount: totalFixed, pct: Math.round((totalFixed / total) * 100) },
    discretionary: { amount: discretionary, pct: Math.round((discretionary / total) * 100) },
    savings: { amount: saved, pct: Math.round((saved / total) * 100) },
  };
}

function buildBudgetRecommendations(breakdown, netSalary, savingsEstimate) {
  const recs = [];
  const savingsRatio = breakdown.savings.pct / 100;

  if (savingsRatio < BUDGET_BENCHMARKS.savings) {
    const gapAmount = Math.round(netSalary * BUDGET_BENCHMARKS.savings) - breakdown.savings.amount;
    recs.push({
      type: 'increase_savings',
      priority: 'high',
      title: 'הגדל חיסכון חודשי',
      description: `כדי להגיע ליחס חיסכון אידאלי של 20%, מומלץ לחסוך עוד ₪${gapAmount.toLocaleString('he-IL')} בחודש.`,
      impact: gapAmount,
    });
  }

  if (breakdown.fixed.pct > 40) {
    recs.push({
      type: 'reduce_fixed',
      priority: 'medium',
      title: 'הוצאות קבועות גבוהות',
      description: 'ההוצאות הקבועות שלך (הלוואות, משכנתא) מהוות יותר מ-40% מהנטו. שקול מחזור הלוואות.',
      impact: null,
    });
  }

  const emergencyFundTarget = (breakdown.fixed.amount + breakdown.discretionary.amount) * BUDGET_BENCHMARKS.emergencyFundMonths;
  const currentSavings = savingsEstimate || 0;
  if (currentSavings < emergencyFundTarget) {
    const gap = Math.round(emergencyFundTarget - currentSavings);
    recs.push({
      type: 'emergency_fund',
      priority: 'high',
      title: 'קרן חירום לא מלאה',
      description: `מומלץ לשמור לפחות ${BUDGET_BENCHMARKS.emergencyFundMonths} חודשי הוצאות כעתודת חירום. חסר עוד ₪${gap.toLocaleString('he-IL')}.`,
      impact: gap,
    });
  }

  if (breakdown.discretionary.pct > 35) {
    recs.push({
      type: 'discretionary_high',
      priority: 'medium',
      title: 'הוצאות שיקול דעת גבוהות',
      description: 'הוצאות שאינן הכרחיות מהוות חלק גבוה מהתקציב. מעקב חודשי יעזור לזהות מקומות לחיסכון.',
      impact: null,
    });
  }

  if (savingsRatio >= 0.25) {
    recs.push({
      type: 'invest_surplus',
      priority: 'low',
      title: 'יש לך עודף לאינבסטמנט!',
      description: 'אתה חוסך יותר מ-25% מהנטו — שקול להשקיע את העודף בתיק השקעות לטווח ארוך.',
      impact: null,
    });
  }

  return recs;
}

function analyzeBudget({ netSalary, grossSalary, monthlyExpenses, monthlyDebts, mortgagePayment, savingsEstimate }) {
  if (!netSalary || netSalary <= 0) {
    return { available: false, reason: 'אין נתוני שכר — יש להעלות תלוש שכר' };
  }

  const expenses = monthlyExpenses || 0;
  const debts = monthlyDebts || 0;
  const mortgage = mortgagePayment || 0;
  const breakdown = buildSpendingBreakdown(netSalary, expenses, debts, mortgage);
  const health = classifyBudgetHealth(breakdown.savings.pct / 100);
  const recommendations = buildBudgetRecommendations(breakdown, netSalary, savingsEstimate);

  // 50/30/20 comparison
  const ideal = {
    needs: Math.round(netSalary * 0.50),
    wants: Math.round(netSalary * 0.30),
    savings: Math.round(netSalary * 0.20),
  };

  const monthlyFreeFlow = Math.max(0, netSalary - expenses - debts - mortgage);

  return {
    available: true,
    netSalary,
    grossSalary,
    expenses,
    debts,
    mortgage,
    breakdown,
    health,
    ideal,
    monthlyFreeFlow,
    recommendations,
    savingsRate: `${breakdown.savings.pct}%`,
  };
}

module.exports = { analyzeBudget };
