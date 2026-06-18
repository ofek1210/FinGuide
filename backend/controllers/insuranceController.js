'use strict';

const { MOCK_INSURANCE_ANALYSIS } = require('../ai/mock/mockData');
const XLSX = require('xlsx');
const InsurancePolicy = require('../models/InsurancePolicy');
const { getInsuranceProfile, analyzeInsuranceCoverage, generateInsuranceRecommendations } = require('../ai/tools/insuranceTools');

// Known policy type keywords for fuzzy matching the Excel rows
const TYPE_KEYWORDS = {
  life:             ['חיים', 'life', 'ריסק'],
  health:           ['בריאות', 'health', 'מחלה', 'ניתוח'],
  disability:       ['אכ"ע', 'נכות', 'disability', 'אובדן כושר'],
  apartment:        ['דירה', 'apartment', 'בית', 'רכוש'],
  car:              ['רכב', 'car', 'חובה', 'מקיף'],
  mortgage:         ['משכנתא', 'mortgage'],
  critical_illness: ['מחלות קשות', 'critical', 'סיעודי', 'סיעוד'],
};

function detectPolicyType(text) {
  const lower = (text || '').toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return type;
    }
  }
  return 'other';
}

function safeNum(val) {
  const n = parseFloat(String(val ?? '').replace(/[,₪\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function safeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val).trim();
  // dd/mm/yyyy → yyyy-mm-dd
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return s || null;
}

/**
 * Parse a Har HaBituach Excel into an array of normalized policy objects.
 * The Excel can have Hebrew headers in various formats — we do loose matching.
 */
function parseInsuranceExcel(buffer, originalName) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const policies = [];

  for (const row of rows) {
    // Flatten all values into a searchable string for type detection
    const allText = Object.values(row).join(' ');

    // Try to map common Hebrew column names
    const find = (...keys) => {
      for (const key of keys) {
        for (const col of Object.keys(row)) {
          if (col.includes(key)) return row[col];
        }
      }
      return null;
    };

    const premium = safeNum(find('פרמיה', 'premium', 'תשלום', 'סכום חודשי'));
    const coverage = safeNum(find('סכום', 'coverage', 'ביטוח', 'כיסוי'));
    const provider = String(find('חברה', 'מבטח', 'provider', 'חברת') || '').trim() || null;
    const policyNum = String(find('פוליסה', 'מספר', 'policy') || '').trim() || null;
    const startDate = safeDate(find('תחילה', 'start', 'תאריך תחילה'));
    const endDate = safeDate(find('תפוגה', 'end', 'סיום', 'פקיעה'));

    // Skip rows that are clearly empty / headers
    if (!premium && !coverage && !provider) continue;

    policies.push({
      type: detectPolicyType(allText),
      provider,
      policyNumber: policyNum,
      monthlyPremium: premium,
      coverageAmount: coverage,
      startDate,
      endDate,
      status: 'active',
      sourceFile: originalName,
      rawData: row,
    });
  }

  return policies;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/insurance/analysis
 */
async function getInsuranceAnalysis(req, res) {
  if (req.query.demo === 'true') {
    return res.json({ success: true, data: MOCK_INSURANCE_ANALYSIS });
  }
  const userId = req.user._id;

  const profileDTO = await getInsuranceProfile(userId);

  // Enrich with real InsurancePolicy docs if present
  const dbPolicies = await InsurancePolicy.find({ user: userId, status: { $ne: 'cancelled' } }).lean();
  if (dbPolicies.length > 0) {
    profileDTO.policies = dbPolicies.map(p => ({
      id: p._id.toString(),
      type: p.type,
      provider: p.provider,
      policyNumber: p.policyNumber,
      monthlyPremium: p.monthlyPremium,
      coverageAmount: p.coverageAmount,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    }));
  }

  const analysis = analyzeInsuranceCoverage(profileDTO);
  const recommendations = generateInsuranceRecommendations(analysis);

  return res.json({
    success: true,
    data: {
      profile: profileDTO.profile,
      personal: profileDTO.personal,
      assets: profileDTO.assets,
      policies: profileDTO.policies,
      analysis,
      recommendations,
      hasImportedPolicies: dbPolicies.length > 0,
    },
  });
}

/**
 * GET /api/insurance/policies
 */
async function getInsurancePolicies(req, res) {
  const policies = await InsurancePolicy.find({ user: req.user._id }).lean();
  return res.json({ success: true, data: policies });
}

/**
 * POST /api/insurance/upload-excel
 */
async function uploadInsuranceExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'לא קיבלנו קובץ Excel' });
  }

  const parsed = parseInsuranceExcel(req.file.buffer, req.file.originalname);

  if (parsed.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'לא הצלחנו לפרסר את הקובץ. ודא שזהו קובץ Har HaBituach תקין.',
    });
  }

  // Upsert policies — delete old ones from same source file, then insert fresh
  await InsurancePolicy.deleteMany({ user: req.user._id, sourceFile: req.file.originalname });

  const docs = parsed.map(p => ({ ...p, user: req.user._id }));
  const inserted = await InsurancePolicy.insertMany(docs);

  return res.json({
    success: true,
    message: `ייבאנו ${inserted.length} פוליסות בהצלחה`,
    data: {
      imported: inserted.length,
      policies: inserted.map(p => ({
        id: p._id.toString(),
        type: p.type,
        provider: p.provider,
        monthlyPremium: p.monthlyPremium,
        status: p.status,
      })),
    },
  });
}

/**
 * DELETE /api/insurance/policies/:id
 */
async function deleteInsurancePolicy(req, res) {
  const policy = await InsurancePolicy.findOne({ _id: req.params.id, user: req.user._id });
  if (!policy) return res.status(404).json({ success: false, message: 'פוליסה לא נמצאה' });
  await policy.deleteOne();
  return res.json({ success: true, message: 'הפוליסה נמחקה' });
}

module.exports = { getInsuranceAnalysis, getInsurancePolicies, uploadInsuranceExcel, deleteInsurancePolicy };
