

const PENSION_VERDICT_PRIORITY = { SWITCH: 'high', NEGOTIATE: 'medium', LEAVE: 'low' };
const INSURANCE_VERDICT = { SWITCH: 'high', REVIEW: 'medium', STAY: 'low' };
const DOMAIN_ACTION_URL = {
  pension: '/pension',
  insurance: '/insurance',
  gemel: '/gemel',
  payslip: '/documents',
};

/**
 * Merge orchestrator outputs into prioritized action items for the UI.
 */
function buildActionItems({ canvas, recommendations = [], agentResults = {}, globalScore = null }) {
  const items = [];
  const seen = new Set();

  const push = item => {
    const key = `${item.domain}::${item.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const pensionAdvice = agentResults.pension?.data?.fundAdvice;
  if (pensionAdvice?.overallVerdict && pensionAdvice.overallVerdict !== 'LEAVE') {
    push({
      priority: PENSION_VERDICT_PRIORITY[pensionAdvice.overallVerdict] || 'medium',
      domain: 'pension',
      title: `פנסיה: ${pensionAdvice.overallVerdictLabelHe || pensionAdvice.overallVerdict}`,
      description: pensionAdvice.funds?.[0]?.summaryHe
        || 'בדוק מסלול, דמי ניהול והשוואה מול השוק',
      actionUrl: '/pension',
      source: 'pension_fund_advisor',
    });
  }

  const gemelAdvice = agentResults.gemel?.data?.marketAdvice;
  if (gemelAdvice?.overallVerdict && gemelAdvice.overallVerdict !== 'LEAVE') {
    push({
      priority: PENSION_VERDICT_PRIORITY[gemelAdvice.overallVerdict] || 'medium',
      domain: 'gemel',
      title: `גמל והשתלמות: ${gemelAdvice.overallVerdictLabelHe || gemelAdvice.overallVerdict}`,
      description: gemelAdvice.funds?.[0]?.summaryHe
        || 'בדוק דמי ניהול ותשואות מול גמל-נט',
      actionUrl: '/gemel',
      source: 'gemel_market_advisor',
    });
  }

  const insuranceAdvice = agentResults.insurance?.data?.marketAdvice;
  if (insuranceAdvice?.overallVerdict && insuranceAdvice.overallVerdict !== 'STAY') {
    push({
      priority: INSURANCE_VERDICT[insuranceAdvice.overallVerdict] || 'medium',
      domain: 'insurance',
      title: `ביטוח: ${insuranceAdvice.overallVerdictLabelHe || insuranceAdvice.overallVerdict}`,
      description: insuranceAdvice.recommendationHe || 'השווה פרמיה ומדד שירות',
      actionUrl: '/insurance',
      source: 'insurance_market_advisor',
    });
  }

  if ((agentResults.insurance?.data?.aggregation?.cancellableMonthlyWaste || 0) > 0) {
    push({
      priority: 'high',
      domain: 'insurance',
      title: 'כפל ביטוחי — בזבוז פרמיות',
      description: `זוהו ${agentResults.insurance.data.aggregation?.redundantDuplications || 0} כפילויות אמיתיות — חיסכון אפשרי ₪${Math.round(agentResults.insurance.data.aggregation.cancellableMonthlyWaste)}/חודש`,
      actionUrl: '/insurance',
      source: 'insurance_agent',
    });
  }

  for (const rec of recommendations.filter(r => r.urgency === 'high').slice(0, 4)) {
    push({
      priority: 'high',
      domain: rec.agentId || 'general',
      title: rec.title,
      description: rec.reason,
      financialImpact: rec.financialImpact || null,
      actionUrl: DOMAIN_ACTION_URL[rec.agentId] || '/documents',
      source: 'agent_recommendation',
    });
  }

  for (const rec of recommendations.filter(r => r.urgency === 'medium').slice(0, 2)) {
    push({
      priority: 'medium',
      domain: rec.agentId || 'general',
      title: rec.title,
      description: rec.reason,
      financialImpact: rec.financialImpact || null,
      source: 'agent_recommendation',
    });
  }

  for (const action of globalScore?.topActions || []) {
    push({
      priority: 'medium',
      domain: 'general',
      title: action.title,
      description: action.description,
      actionUrl: action.actionUrl,
      source: 'financial_health_score',
    });
  }

  for (const [, domain] of Object.entries(canvas?.domains || {})) {
    if (!domain.dataAvailable && domain.priority === 'high') {
      const uploadTask = domain.tasks?.find(t => t.priority === 'high');
      if (uploadTask) {
        push({
          priority: 'high',
          domain: domain.id,
          title: uploadTask.label,
          description: `חסרים נתונים ב-${domain.labelHe}`,
          actionUrl: DOMAIN_ACTION_URL[domain.id] || '/pension',
          source: 'execution_canvas',
        });
      }
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return items
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
    .slice(0, 8);
}

module.exports = { buildActionItems };
