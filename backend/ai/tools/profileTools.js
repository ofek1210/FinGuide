/**
 * Financial Profile Agent Tools
 * Flow: Agent → Tool → Service → DTO
 */



const UserProfile = require('../../models/UserProfile');
const { runDocumentCompletenessRules } = require('../engines/ruleEngine');
const { calculateQuickHealthScore } = require('../engines/calculationEngine');
const Document = require('../../models/Document');

// ── Tool: getFinancialProfile ─────────────────────────────────────────────────

/**
 * @param {string} userId
 * @returns {Promise<FinancialProfileDTO>}
 */
async function getFinancialProfile(userId) {
  if (!userId) throw new Error('userId is required');

  const [profile, docs] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    Document.find({ user: userId }).select('status metadata.category').lean(),
  ]);

  const uploadedCategories = docs
    .filter((d) => d.status === 'completed')
    .map((d) => d.metadata?.category || 'unknown');

  const docRules = runDocumentCompletenessRules(uploadedCategories);

  return {
    hasProfile: Boolean(profile),
    personal: {
      age: profile?.personal?.age ?? null,
      gender: profile?.personal?.gender ?? null,
      maritalStatus: profile?.personal?.maritalStatus ?? null,
      childrenCount: profile?.personal?.childrenCount ?? null,
    },
    financial: {
      salaryRange: profile?.financial?.salaryRange ?? null,
      riskTolerance: profile?.financial?.riskTolerance ?? null,
      monthlyExpenses: profile?.financial?.monthlyExpensesEstimate ?? null,
      monthlyDebts: profile?.financial?.monthlyDebts ?? null,
      savingsEstimate: profile?.financial?.savingsEstimate ?? null,
    },
    assets: {
      ownsApartment: profile?.assets?.ownsApartment ?? null,
      ownsCar: profile?.assets?.ownsCar ?? null,
      hasMortgage: profile?.assets?.hasMortgage ?? null,
    },
    documentStats: {
      totalDocuments: docs.length,
      completedDocuments: docs.filter((d) => d.status === 'completed').length,
      categories: uploadedCategories,
      ...docRules,
    },
    goals: (profile?.goals || []).map((g) => ({
      id: g._id?.toString(),
      type: g.type,
      label: g.label,
      targetAmount: g.targetAmount,
    })),
  };
}

// ── Tool: calculateRiskProfile ────────────────────────────────────────────────

/**
 * Determine investment risk profile.
 * @param {FinancialProfileDTO} profile
 * @returns {{ riskLevel: string, riskLabel: string, recommendedAllocation: object }}
 */
function calculateRiskProfile(profile) {
  const age = profile.personal?.age;
  const riskTolerance = profile.financial?.riskTolerance;
  const hasMortgage = profile.assets?.hasMortgage;
  const childrenCount = profile.personal?.childrenCount || 0;

  // Score-based risk calculation
  let score = 50;

  if (age) {
    if (age < 35) score += 20;
    else if (age < 50) score += 10;
    else score -= 10;
  }

  if (riskTolerance === 'high') score += 20;
  else if (riskTolerance === 'low') score -= 20;

  if (hasMortgage) score -= 10;
  if (childrenCount > 2) score -= 10;

  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const label =
    level === 'high' ? 'פרופיל סיכון גבוה — מניות ונכסים צמיחה'
    : level === 'medium' ? 'פרופיל סיכון בינוני — מגוון מאוזן'
    : 'פרופיל סיכון נמוך — אגרות חוב ונכסים יציבים';

  const allocation =
    level === 'high' ? { stocks: 75, bonds: 15, realEstate: 10 }
    : level === 'medium' ? { stocks: 50, bonds: 35, realEstate: 15 }
    : { stocks: 25, bonds: 60, realEstate: 15 };

  return { riskLevel: level, riskScore: score, riskLabel: label, recommendedAllocation: allocation };
}

// ── Tool: detectFinancialPriorities ──────────────────────────────────────────

/**
 * Detect top financial priorities from profile.
 * @param {FinancialProfileDTO} profile
 * @returns {string[]} - list of priority codes
 */
function detectFinancialPriorities(profile) {
  const priorities = [];

  if (profile.documentStats.missingRequired?.length > 0) {
    priorities.push('upload_payslip');
  }
  if (!profile.personal.age) {
    priorities.push('complete_profile');
  }
  if (profile.financial.monthlyExpenses === null) {
    priorities.push('add_expenses');
  }
  if (profile.goals.length === 0) {
    priorities.push('set_goals');
  }

  return priorities;
}

module.exports = {
  getFinancialProfile,
  calculateRiskProfile,
  detectFinancialPriorities,
};
