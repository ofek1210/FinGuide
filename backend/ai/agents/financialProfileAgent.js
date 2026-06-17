/**
 * Financial Profile Agent
 *
 * Pipeline: getFinancialProfile → calculateRiskProfile → detectPriorities → LLM
 */

'use strict';

const { getFinancialProfile, calculateRiskProfile, detectFinancialPriorities } = require('../tools/profileTools');

/**
 * @param {string} userId
 * @returns {Promise<ProfileAgentResult>}
 */
async function runFinancialProfileAgent(userId) {
  const startedAt = Date.now();

  const profile = await getFinancialProfile(userId);
  const riskProfile = calculateRiskProfile(profile);
  const priorities = detectFinancialPriorities(profile);

  return {
    agentId: 'profile',
    status: 'success',
    data: {
      profile,
      riskProfile,
      priorities,
      documentCompleteness: profile.documentStats.completenessScore,
    },
    recommendations: priorities.map((p) => ({
      type: p,
      title: priorityLabel(p),
      urgency: 'medium',
      confidenceScore: 100,
    })),
    llmExplanation: null,
    durationMs: Date.now() - startedAt,
  };
}

function priorityLabel(code) {
  const map = {
    upload_payslip: 'העלה תלוש שכר לניתוח ראשוני',
    complete_profile: 'השלם פרטים אישיים בפרופיל',
    add_expenses: 'הוסף הוצאות חודשיות לניתוח תקציב',
    set_goals: 'הגדר יעדים פיננסיים',
  };
  return map[code] || code;
}

module.exports = { runFinancialProfileAgent };
