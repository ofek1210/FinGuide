'use strict';

/**
 * Execution Canvas — structured work plan before multi-agent analysis.
 * Maps onboarding + DB inventory to domain tasks (CrewAI task_build_canvas equivalent).
 */
const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');
const InsurancePolicy = require('../../models/InsurancePolicy');
const PensionFund = require('../../models/PensionFund');

function buildDomainTasks(domain, ctx) {
  const tasks = [];
  const { personal, employment, assets, insurance } = ctx.profile || {};

  if (domain === 'payslip') {
    if (ctx.payslipCount === 0) tasks.push({ id: 'upload_payslips', label: 'העלאת 3 תלושי שכר אחרונים', priority: 'high' });
    if (employment?.hasMultipleEmployers) {
      tasks.push({ id: 'tax_coordination', label: 'בדיקת חובת תיאום מס (2 מעסיקים)', priority: 'high' });
    }
    if (ctx.payslipCount > 0) {
      tasks.push({ id: 'contribution_audit', label: 'בדיקת תקינות הפרשות סוציאליות', priority: 'medium' });
      tasks.push({ id: 'salary_insights', label: 'זיהוי חריגות שכר והחזרי מס', priority: 'medium' });
    }
  }

  if (domain === 'insurance') {
    if (ctx.policyCount === 0) tasks.push({ id: 'import_har_habituach', label: 'ייבוא Excel מהר הביטוח', priority: 'high' });
    if (personal?.isSmoker === true) {
      tasks.push({ id: 'smoker_premium', label: 'השוואת פרמיה מעשן/לא מעשן', priority: 'medium' });
    }
    if ((personal?.childrenCount ?? 0) === 0 && !assets?.hasMortgage) {
      tasks.push({ id: 'life_necessity', label: 'בדיקת נחיצות ביטוח חיים', priority: 'medium' });
    }
    if (ctx.policyCount > 0) {
      tasks.push({ id: 'duplicate_scan', label: 'סריקת כפל ביטוחי', priority: 'high' });
      tasks.push({ id: 'service_index', label: 'השוואה למדד השירות הממשלתי', priority: 'medium' });
    }
  }

  if (domain === 'pension') {
    if (ctx.fundCount === 0 && ctx.payslipCount === 0) {
      tasks.push({ id: 'import_pension', label: 'ייבוא דוח הר הכסף או הזנה ידנית', priority: 'high' });
    }
    if (ctx.fundCount > 0 || ctx.payslipCount > 0) {
      tasks.push({ id: 'fee_benchmark', label: 'השוואת דמי ניהול מול פנסיה-נט', priority: 'high' });
      tasks.push({ id: 'risk_track', label: 'התאמת מסלול סיכון לגיל', priority: 'medium' });
    }
    if (personal?.age != null && personal.age < 45) {
      tasks.push({ id: 'young_equity', label: 'בדיקת מסלול מנייתי לטווח ארוך', priority: 'medium' });
    }
  }

  return tasks;
}

function domainPriority(domain, ctx) {
  if (domain === 'payslip' && ctx.payslipCount === 0) return 'high';
  if (domain === 'insurance' && ctx.policyCount === 0) return 'high';
  if (domain === 'pension' && ctx.fundCount === 0 && ctx.payslipCount === 0) return 'high';
  if (domain === 'payslip' && ctx.payslipCount > 0) return 'medium';
  return 'medium';
}

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.focus] - all | payslip | insurance | pension
 */
async function buildExecutionCanvas(userId, { focus = 'all' } = {}) {
  const [profile, payslipCount, policyCount, fundCount] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    Document.countDocuments({
      user: userId,
      status: 'completed',
      $or: [
        { 'metadata.category': 'payslip' },
        { 'analysisData.summary.grossSalary': { $exists: true, $ne: null } },
      ],
    }),
    InsurancePolicy.countDocuments({ user: userId, status: { $nin: ['cancelled', 'expired'] } }),
    PensionFund.countDocuments({ user: userId, status: { $ne: 'closed' }, isActive: { $ne: false } }),
  ]);

  const personal = profile?.personal || {};
  const employment = profile?.employment || {};
  const assets = profile?.assets || {};

  const ctx = { profile, payslipCount, policyCount, fundCount };

  const allDomains = {
    payslip: {
      id: 'payslip',
      labelHe: 'שכר ומיסוי',
      enabled: focus === 'all' || focus === 'payslip',
      priority: domainPriority('payslip', ctx),
      dataAvailable: payslipCount > 0,
      dataCount: payslipCount,
      tasks: buildDomainTasks('payslip', ctx),
    },
    insurance: {
      id: 'insurance',
      labelHe: 'ביטוח וניהול סיכונים',
      enabled: focus === 'all' || focus === 'insurance',
      priority: domainPriority('insurance', ctx),
      dataAvailable: policyCount > 0,
      dataCount: policyCount,
      tasks: buildDomainTasks('insurance', ctx),
    },
    pension: {
      id: 'pension',
      labelHe: 'פנסיה וחיסכון',
      enabled: focus === 'all' || focus === 'pension',
      priority: domainPriority('pension', ctx),
      dataAvailable: fundCount > 0 || payslipCount > 0,
      dataCount: fundCount,
      tasks: buildDomainTasks('pension', ctx),
    },
  };

  const domains = Object.fromEntries(
    Object.entries(allDomains).filter(([, d]) => d.enabled),
  );

  const agentsToRun = Object.keys(domains);
  if (focus === 'all') agentsToRun.push('profile');

  return {
    userId: String(userId),
    generatedAt: new Date().toISOString(),
    focus,
    onboarding: {
      age: personal.age ?? null,
      isSmoker: personal.isSmoker ?? null,
      hasDependents: (personal.childrenCount ?? 0) > 0,
      childrenCount: personal.childrenCount ?? 0,
      hasMultipleEmployers: employment.hasMultipleEmployers ?? null,
      ownsApartment: assets.ownsApartment ?? null,
      hasMortgage: assets.hasMortgage ?? null,
      ownsCar: assets.ownsCar ?? null,
      onboardingCompleted: Boolean(profile?.completedAt),
    },
    dataInventory: {
      payslipCount,
      policyCount,
      fundCount,
      profileComplete: Boolean(profile?.completedAt),
    },
    domains,
    agentsToRun,
    summaryHe: [
      payslipCount ? `${payslipCount} תלושים` : 'אין תלושים',
      policyCount ? `${policyCount} פוליסות` : 'אין ביטוח',
      fundCount ? `${fundCount} קרנות` : 'אין פנסיה',
    ].join(' · '),
  };
}

module.exports = { buildExecutionCanvas, buildDomainTasks };
