

const XLSX = require('xlsx');
const { parseHarHaBituachBuffer, isHarHaBituachBuffer } = require('./harHaBituachService');
const { aggregatePoliciesByPolicyNumber } = require('./insurancePolicyAggregationService');

const TYPE_KEYWORDS = {
  life:             ['חיים', 'life', 'ריסק'],
  health:           ['בריאות', 'health', 'מחלה', 'ניתוח'],
  disability:       ['אכ"ע', 'נכות', 'disability', 'אובדן כושר'],
  apartment:        ['דירה', 'apartment', 'בית', 'רכוש'],
  car:              ['רכב', 'car', 'חובה', 'מקיף'],
  mortgage:         ['משכנתא', 'mortgage'],
  critical_illness: ['מחלות קשות', 'critical', 'סיעודי', 'סיעוד'],
};

const BRANCH_TO_POLICY_TYPE = {
  health: 'health',
  life: 'life',
  car: 'car',
  apartment: 'apartment',
  disability: 'disability',
  mortgage: 'mortgage',
  critical_illness: 'critical_illness',
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
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${  m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s || null;
}

function mapHarPolicyToImport(policy, originalName) {
  const isMonthly = (policy.premiumType || '').includes('חודשי');
  const isAnnual = (policy.premiumType || '').includes('שנתי');
  let monthlyPremium = null;
  let annualPremium = null;

  if (policy.premium != null) {
    if (isAnnual) {
      annualPremium = policy.premium;
      monthlyPremium = Math.round((policy.premium / 12) * 100) / 100;
    } else {
      monthlyPremium = policy.premium;
      if (isMonthly) {
        annualPremium = Math.round(policy.premium * 12 * 100) / 100;
      }
    }
  }

  const contextText = [
    policy.mainBranch,
    policy.subBranch,
    policy.productType,
    policy.planClass,
    policy.extra,
  ].join(' ');

  const type = BRANCH_TO_POLICY_TYPE[policy.branchType]
    || detectPolicyType(contextText);

  return {
    type,
    provider: policy.company || null,
    policyNumber: policy.policyNumber || null,
    monthlyPremium,
    annualPremium,
    coverageAmount: null,
    startDate: policy.period?.from || null,
    endDate: policy.period?.to || null,
    status: 'active',
    sourceFile: originalName,
    rawData: policy,
  };
}

function parseHarHaBituachImport(buffer, originalName) {
  const parsed = parseHarHaBituachBuffer(buffer);
  const rows = (parsed.policies || [])
    .filter(p => p.company || p.policyNumber)
    .map(p => mapHarPolicyToImport(p, originalName));
  return aggregatePoliciesByPolicyNumber(rows);
}

function parseGenericInsuranceExcel(buffer, originalName) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const policies = [];

  for (const row of rows) {
    const allText = Object.values(row).join(' ');

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

function parseInsuranceExcel(buffer, originalName) {
  if (isHarHaBituachBuffer(buffer)) {
    const harPolicies = parseHarHaBituachImport(buffer, originalName);
    if (harPolicies.length > 0) return harPolicies;
  }

  return parseGenericInsuranceExcel(buffer, originalName);
}

module.exports = {
  parseInsuranceExcel,
  detectPolicyType,
  mapHarPolicyToImport,
};
