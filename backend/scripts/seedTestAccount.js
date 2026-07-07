#!/usr/bin/env node
/**
 * Seed a fully-populated test account for manual/agent testing.
 *
 * Creates (or replaces) one user with:
 *   - completed onboarding profile (personal/financial/assets/insurance/retirement/employment)
 *   - 3 months of payslip Documents with realistic analysisData (schema_version 1.9)
 *   - insurance policies imported through the REAL Har HaBituach parser + import
 *     pipeline (services/insuranceExcelParser + insuranceImportService), including
 *     one deliberate duplicate (2x health) and one deliberate gap (no disability)
 *   - pension funds imported through the REAL Har HaKesef parser + import pipeline
 *     (services/harHaKesefService + pensionImportService): one comprehensive pension
 *     fund with an above-market fee, one healthy study fund
 *   - the same post-onboarding side effects production runs (insightsEngine +
 *     insuranceRecommender), so Insights/Recommendations are populated too
 *
 * This talks to MongoDB directly — the backend server does NOT need to be running.
 *
 * Usage:
 *   node backend/scripts/seedTestAccount.js
 *   node backend/scripts/seedTestAccount.js --email foo@bar.com --password Secret123
 *
 * Env overrides: SEED_EMAIL, SEED_PASSWORD
 */

'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const connectDB = require('../config/db');

const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const Document = require('../models/Document');
const InsurancePolicy = require('../models/InsurancePolicy');
const PensionFund = require('../models/PensionFund');
const InsuranceImportSnapshot = require('../models/InsuranceImportSnapshot');
const PensionImportSnapshot = require('../models/PensionImportSnapshot');
const Insight = require('../models/Insight');
const Recommendation = require('../models/Recommendation');
const Notification = require('../models/Notification');
const AgentRunLog = require('../models/AgentRunLog');

const {
  normalizeLegacyPatch,
  mergeProfilePatch,
  validateComplete,
} = require('../utils/onboardingValidation');

const { parseInsuranceExcel } = require('../services/insuranceExcelParser');
const { importInsuranceExcel } = require('../services/insuranceImportService');
const { parseHarHaKesef } = require('../services/harHaKesefService');
const { importPensionFile } = require('../services/pensionImportService');
const { runFullAnalysis: runInsightsEngine } = require('../services/insightsEngine');
const { run: runInsuranceRecommender } = require('../services/insuranceRecommender');

// ── CLI args / env ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--email') opts.email = argv[++i];
    if (argv[i] === '--password') opts.password = argv[++i];
  }
  return opts;
}

const cli = parseArgs(process.argv.slice(2));
const EMAIL = cli.email || process.env.SEED_EMAIL || 'agent.tester@finguide.dev';
const PASSWORD = cli.password || process.env.SEED_PASSWORD || 'AgentTest123!';
const FULL_NAME = 'נועה כהן';

// ── payslip data (3 months, real analysisData shape — bypasses OCR since it's
//    a fragile, system-binary-dependent step; the DB shape produced here is
//    byte-for-byte what a real OCR extraction would write) ───────────────────

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

/** Minimal valid single-page PDF so /api/documents/:id/download has a real file to serve. */
function buildPlaceholderPdf(label) {
  const text = `(${label}) Tj`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
      `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n` +
      `4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
      `5 0 obj<</Length ${text.length + 20}>>stream\nBT /F1 10 Tf 10 50 Td ${text} ET\nendstream endobj\n` +
      `trailer<</Root 1 0 R>>`,
    'utf8',
  );
}

function buildPayslipAnalysisData({ year, month, gross, employeeName, employerName }) {
  const pensionEmployee = Math.round(gross * 0.06);
  const pensionEmployer = Math.round(gross * 0.065);
  const pensionSeverance = Math.round(gross * 0.0833);
  const studyFundEmployee = Math.round(gross * 0.025);
  const studyFundEmployer = Math.round(gross * 0.075);
  const tax = Math.round(gross * 0.17);
  const nationalInsurance = Math.round(gross * 0.07);
  const healthInsurance = Math.round(gross * 0.032);
  const mandatoryDeductionsTotal = tax + nationalInsurance + healthInsurance;
  const netSalary = gross - mandatoryDeductionsTotal - pensionEmployee - studyFundEmployee;
  const periodLabel = `${String(month).padStart(2, '0')}/${year}`;

  const summary = {
    employeeName,
    employerName,
    employeeId: '123456789',
    date: `${year}-${String(month).padStart(2, '0')}-01`,
    grossSalary: gross,
    netSalary,
    baseSalary: gross,
    vacationDays: 12,
    sickDays: 8,
    pensionEmployee,
    pensionEmployer,
    pensionSeverance,
    trainingFundEmployee: studyFundEmployee,
    trainingFundEmployer: studyFundEmployer,
    trainingFundEmployeeRate: 2.5,
    trainingFundEmployerRate: 7.5,
    tax,
    nationalInsurance,
    healthInsurance,
    mandatoryDeductionsTotal,
    marginalTaxRate: 31,
    taxCreditPoints: 2.75,
    jobPercentage: 100,
    workingDays: 22,
    workingHours: null,
  };

  return {
    schema_version: '1.9',
    period: { month: `${year}-${String(month).padStart(2, '0')}` },
    salary: {
      gross_total: gross,
      net_payable: netSalary,
      components: [{ type: 'base_salary', amount: gross }],
    },
    deductions: {
      mandatory: {
        income_tax: tax,
        national_insurance: nationalInsurance,
        health_insurance: healthInsurance,
        total: mandatoryDeductionsTotal,
      },
    },
    contributions: {
      pension: { employee: pensionEmployee, employer: pensionEmployer, severance: pensionSeverance },
      study_fund: {
        employee: studyFundEmployee,
        employer: studyFundEmployer,
        employee_rate_percent: 2.5,
        employer_rate_percent: 7.5,
      },
    },
    tax: { marginal_tax_rate_percent: 31, tax_credit_points: 2.75 },
    parties: { employee_name: employeeName, employer_name: employerName, employee_id: '123456789' },
    employment: { job_percent: 100, employment_start_date: '2019-03-01' },
    summary,
    quality: { validation: { status: 'valid', warnings: [] } },
    raw: { rawText: `תלוש שכר לחודש ${periodLabel}`, ocr_text: null },
  };
}

async function seedPayslips(userId) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // 3 months, ending with a real raise so trend detection has something to say.
  const months = [
    { year: 2026, month: 3, gross: 18500 },
    { year: 2026, month: 4, gross: 18500 },
    { year: 2026, month: 5, gross: 19200 },
  ];

  const created = [];
  for (const m of months) {
    const analysisData = buildPayslipAnalysisData({
      ...m,
      employeeName: FULL_NAME,
      employerName: 'טכנולוגיות רימון בע"מ',
    });
    const filename = `seed-${userId}-${m.year}-${String(m.month).padStart(2, '0')}-${crypto.randomUUID()}.pdf`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const pdfBuffer = buildPlaceholderPdf(`Payslip ${m.month}/${m.year}`);
    fs.writeFileSync(filePath, pdfBuffer);

    const doc = await Document.create({
      user: userId,
      originalName: `payslip-${m.year}-${String(m.month).padStart(2, '0')}.pdf`,
      filename,
      filePath,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      metadata: {
        category: 'payslip',
        periodMonth: m.month,
        periodYear: m.year,
        documentDate: new Date(m.year, m.month - 1, 1),
        source: 'manual_upload',
      },
      checksumSha256: crypto.createHash('sha256').update(pdfBuffer).digest('hex'),
      status: 'completed',
      uploadedAt: new Date(m.year, m.month - 1, 3),
      processedAt: new Date(m.year, m.month - 1, 3),
      analysisData,
    });
    created.push(doc);
  }
  return created;
}

// ── insurance: build a real הר הביטוח XLSX and run it through the real parser +
//    import pipeline (services/insuranceExcelParser + insuranceImportService) ──

function buildHarHaBituachWorkbook() {
  // Column layout is deliberately ordered so services/harHaBituachService.js's
  // substring-based column matching resolves each field to a distinct index
  // (see findCol — first header index containing the search term wins).
  const HEADER = [
    'תעודת זהות', 'ענף משני', 'ענף ראשי', 'חברה', 'סוג מוצר',
    'תקופת ביטוח', 'פרמיה', 'סוג פרמיה', 'מספר פוליסה', 'סיווג תכנית', 'פרטים נוספים',
  ];
  const ID = '123456789';
  const rows = [
    ['דוח הר הביטוח', '', '', '', '', '04/07/2026'],
    HEADER,
    // health — two policies from different companies → a deliberate duplicate
    [null, null, 'תחום - בריאות ותאונות אישיות', null, null, null, null, null, null, null, null],
    [ID, 'אשפוז וניתוחים פרטי', '', 'הראל', 'ביטוח בריאות פרטי מורחב', '01/01/2025 - 31/12/2026', 185, 'חודשי', 'POL-1001', 'מורחב', ''],
    [ID, 'אשפוז וניתוחים', '', 'כלל בריאות', 'ביטוח בריאות פרטי בסיסי', '01/06/2024 - 31/05/2026', 142, 'חודשי', 'POL-1002', 'בסיסי', ''],
    // life
    [null, null, 'תחום - ביטוח חיים', null, null, null, null, null, null, null, null],
    [ID, 'ריסק למשכנתא', '', 'מגדל', 'ביטוח חיים למשכנתא', '01/03/2020 - 28/02/2045', 96, 'חודשי', 'POL-2001', '', ''],
    // car
    [null, null, 'תחום - רכב', null, null, null, null, null, null, null, null],
    [ID, 'מקיף', '', 'הפניקס', 'ביטוח רכב מקיף', '01/01/2026 - 31/12/2026', 210, 'חודשי', 'POL-3001', '', ''],
    // apartment
    [null, null, 'תחום - דירה', null, null, null, null, null, null, null, null],
    [ID, 'מבנה ותכולה', '', 'איילון', 'ביטוח דירה מבנה ותכולה', '01/01/2026 - 31/12/2026', 78, 'חודשי', 'POL-4001', '', ''],
    // deliberately NO disability (אכ"ע) policy — a real, visible coverage gap
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'הר הביטוח');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function seedInsurance(userId) {
  const buffer = buildHarHaBituachWorkbook();
  const originalName = 'har_habituach_seed.xlsx';
  const parsed = parseInsuranceExcel(buffer, originalName);
  return importInsuranceExcel(userId, parsed, originalName);
}

// ── pension: build a real הר הכסף XLSX and run it through the real parser +
//    import pipeline (services/harHaKesefService + pensionImportService) ─────

function buildHarHaKesefWorkbook() {
  // Column order chosen so services/harHaKesefService.js's findColumnIndex
  // (candidate-order matching) resolves each field distinctly.
  const HEADER = [
    'מספר חשבון', 'חברה מנהלת', 'שם קרן', 'סוג קופה', 'יתרה צבורה',
    'הפקדת עובד חודשית', 'הפקדת מעסיק חודשית', 'דמי ניהול מצבירה', 'דמי ניהול מהפקדה',
    'מסלול השקעה', 'סטטוס',
  ];
  const rows = [
    ['דוח הר הכסף', '', '', '', '', '04/07/2026'],
    HEADER,
    // comprehensive pension — fee is above the healthy market range on purpose,
    // so the pension agent has a real SWITCH/NEGOTIATE verdict to surface
    ['PF-778812', 'מנורה מבטחים', 'מנורה מבטחים - פנסיה מקיפה', 'קרן פנסיה מקיפה חדשה', 186400, 1110, 1203, '0.9', '2.5', 'מסלול כללי', 'פעיל'],
    // study fund — healthy fee, nothing to flag
    ['SF-334521', 'הראל', 'הראל - קרן השתלמות', 'קרן השתלמות', 64200, 462.5, 1387.5, '0.3', '0', 'מסלול מנייתי', 'פעיל'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'הר הכסף');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function seedPension(userId) {
  const buffer = buildHarHaKesefWorkbook();
  const originalName = 'har_hakesef_seed.xlsx';
  const parsed = await parseHarHaKesef(buffer, {
    ext: '.xlsx',
    originalName,
    importSource: 'har_hakesef',
  });
  return importPensionFile(userId, parsed.funds, 'har_hakesef', originalName);
}

// ── onboarding profile (mirrors controllers/onboardingController.completeOnboarding) ─

async function seedOnboarding(user) {
  const patch = normalizeLegacyPatch({
    personal: {
      fullName: FULL_NAME,
      age: 34,
      gender: 'female',
      occupation: 'מהנדסת תוכנה',
      maritalStatus: 'married',
      childrenCount: 2,
      childrenAges: [4, 7],
      spouseWorks: true,
    },
    financial: {
      salaryRange: '15k_20k',
      monthlyExpensesEstimate: 12000,
      savingsEstimate: 45000,
    },
    assets: {
      ownsApartment: true,
      ownsCar: true,
      hasMortgage: true,
      mortgageMonthlyPayment: 5200,
    },
    insurance: {
      // Deliberately incomplete — the real Har HaBituach import below will
      // overwrite these based on the actual imported policies anyway.
      hasLifeInsurance: false,
      hasHealthInsurance: false,
      hasDisabilityInsurance: false,
      hasApartmentInsurance: false,
      hasCarInsurance: false,
    },
    retirement: {
      hasPension: true,
      hasStudyFund: true,
      hasInvestmentFunds: false,
    },
    employment: {
      salaryType: 'global',
      expectedMonthlyGross: 18500,
      jobPercentage: 100,
      isPrimaryJob: true,
      hasMultipleEmployers: false,
      employmentStartDate: '2019-03-01',
      hasTaxCoordination: false,
      pensionEmployeeRate: 6,
      pensionEmployerRate: 6.5,
      studyFundEmployeeRate: 2.5,
      studyFundEmployerRate: 7.5,
    },
  });

  const profile = await UserProfile.findOrCreateForUser(user._id);
  mergeProfilePatch(profile, patch);

  const merged = profile.toObject ? profile.toObject() : profile;
  validateComplete(merged); // throws if something's missing — fail loudly, not silently

  profile.completedAt = profile.completedAt || new Date();
  await profile.save();

  user.onboarding = user.onboarding || {};
  user.onboarding.completed = true;
  user.onboarding.completedAt = new Date();
  user.onboarding.updatedAt = new Date();
  user.onboarding.data = profile.toLegacyOnboardingData();
  await user.save();

  return profile;
}

// ── wipe any previous seed for this email (repeatable, fresh snapshots) ──────

async function wipeExisting(email) {
  const existing = await User.findOne({ email });
  if (!existing) return;

  const uid = existing._id;
  const docs = await Document.find({ user: uid }).select('filePath').lean();
  for (const d of docs) {
    if (d.filePath) fs.rmSync(d.filePath, { force: true });
  }

  await Promise.all([
    Document.deleteMany({ user: uid }),
    InsurancePolicy.deleteMany({ user: uid }),
    PensionFund.deleteMany({ user: uid }),
    InsuranceImportSnapshot.deleteMany({ user: uid }),
    PensionImportSnapshot.deleteMany({ user: uid }),
    Insight.deleteMany({ user: uid }),
    Recommendation.deleteMany({ user: uid }),
    Notification.deleteMany({ user: uid }),
    AgentRunLog.deleteMany({ user: uid }),
    UserProfile.deleteMany({ user: uid }),
  ]);
  await existing.deleteOne();
  console.log(`  (removed previous seed for ${email})`);
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();

  console.log(`\nSeeding test account: ${EMAIL}`);
  await wipeExisting(EMAIL);

  const user = await User.create({ name: FULL_NAME, email: EMAIL, password: PASSWORD });
  console.log(`  ✓ user created (${user._id})`);

  await seedOnboarding(user);
  console.log('  ✓ onboarding profile completed');

  const payslips = await seedPayslips(user._id);
  console.log(`  ✓ ${payslips.length} payslip documents (Mar–May 2026, incl. a real raise)`);

  const insuranceResult = await seedInsurance(user._id);
  console.log(`  ✓ insurance imported via real Har HaBituach pipeline: ${insuranceResult.policies.length} policies (1 duplicate pair, no disability cover)`);

  const pensionResult = await seedPension(user._id);
  console.log(`  ✓ pension imported via real Har HaKesef pipeline: ${pensionResult.funds.length} funds (1 above-market fee, 1 healthy)`);

  try {
    await runInsightsEngine(user._id);
    console.log('  ✓ insightsEngine ran (payslip trend/anomaly Insights populated)');
  } catch (err) {
    console.warn('  ⚠ insightsEngine failed (non-fatal):', err.message);
  }

  try {
    await runInsuranceRecommender(user._id);
    console.log('  ✓ insuranceRecommender ran (Recommendations populated)');
  } catch (err) {
    console.warn('  ⚠ insuranceRecommender failed (non-fatal):', err.message);
  }

  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

  console.log('\n──────────────────────────────────────────────────────────');
  console.log('Done. Login:');
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log('\nTo drop straight into a logged-in Preview session, run in the browser console');
  console.log('(or via preview_eval on the app\'s own origin, not a data:/blank page):\n');
  console.log(`  localStorage.setItem("token", "${token}"); window.location.href = "/hub";`);
  console.log('──────────────────────────────────────────────────────────\n');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
