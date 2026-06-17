const Document = require('../models/Document');
const UserProfile = require('../models/UserProfile');
const Recommendation = require('../models/Recommendation');
const { buildTaxAssistantSummary, buildYearEntries, enrichEntrySummary, getEmployerName, isForm106Document, HEBREW_MONTHS } = require('./taxAssistantService');

const CATEGORY_MAX = {
  documentCompleteness: 25,
  salaryStability: 20,
  taxReadiness: 20,
  pensionConsistency: 20,
  riskInsurance: 15,
};

const DISCLAIMER =
  'הציון מבוסס על המסמכים והמידע שהועלו למערכת ואינו מהווה ייעוץ פיננסי או ייעוץ מס.';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.round(value)));

const statusFromRatio = ratio => {
  if (ratio >= 0.85) return 'good';
  if (ratio >= 0.55) return 'warning';
  return 'poor';
};

const getScoreLevel = score => {
  if (score >= 85) return { level: 'excellent', label: 'מצב פיננסי מצוין' };
  if (score >= 70) return { level: 'good', label: 'מצב פיננסי טוב' };
  if (score >= 50) return { level: 'fair', label: 'יש מקום לשיפור' };
  return { level: 'poor', label: 'דורש טיפול' };
};

const formatMonthList = months =>
  months
    .slice()
    .sort((a, b) => a - b)
    .map(m => HEBREW_MONTHS[m] || String(m))
    .join(' ו');

const countPossibleDuplicateDocuments = documents => {
  const duplicateMap = new Map();
  documents.forEach(doc => {
    const key = `${doc.originalName || ''}::${doc.fileSize ?? ''}`;
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  });
  return [...duplicateMap.values()].reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
};

const hasInsuranceProfileCompletion = profile => {
  const insurance = profile?.insurance || {};
  const fields = [
    insurance.hasLifeInsurance,
    insurance.hasHealthInsurance,
    insurance.hasDisabilityInsurance,
    insurance.hasApartmentInsurance,
    insurance.hasCarInsurance,
  ];
  const answered = fields.filter(value => value === true || value === false).length;
  return { answered, complete: answered >= 4 };
};

const scoreDocumentCompleteness = (documents, yearStats, year) => {
  const maxScore = CATEGORY_MAX.documentCompleteness;
  let score = 0;
  const messages = [];

  const monthsPresent = yearStats.monthsPresent?.length || 0;
  const payslipPoints = (monthsPresent / 12) * 15;
  score += payslipPoints;

  if (monthsPresent >= 10) {
    messages.push('רוב חודשי השכר מכוסים בתלושים');
  } else if (monthsPresent > 0) {
    messages.push(`קיימים תלושים ב-${monthsPresent} מתוך 12 חודשים`);
  } else {
    messages.push('לא נמצאו תלושי שכר לשנה שנבחרה');
  }

  if (yearStats.missingMonths?.length) {
    messages.push(`חסרים תלושים עבור ${formatMonthList(yearStats.missingMonths)}`);
  }

  const hasForm106 = documents.some(doc => isForm106Document(doc, year));
  if (hasForm106) {
    score += 7;
    messages.push('נמצא טופס 106 או דוח מס לשנה');
  } else if (monthsPresent > 0) {
    messages.push('לא נמצא טופס 106');
  }

  const hasPensionRelatedDoc = documents.some(doc => {
    if (doc.status !== 'completed') return false;
    if (doc.metadata?.category === 'pension_report') return true;
    const name = (doc.originalName || '').toLowerCase();
    return name.includes('ביטוח') || name.includes('insurance') || name.includes('פנסיה');
  });
  if (hasPensionRelatedDoc) {
    score += 3;
    messages.push('קיים מסמך פנסיה/השתלמות במערכת');
  } else if (monthsPresent > 0) {
    messages.push('מומלץ להעלות דוח פנסיה אם קיים');
  }

  const finalScore = clamp(score, 0, maxScore);
  return {
    key: 'documentCompleteness',
    name: 'שלמות מסמכים',
    score: finalScore,
    maxScore,
    status: statusFromRatio(finalScore / maxScore),
    messages: [...new Set(messages)],
  };
};

const scoreSalaryStability = (entries, employers) => {
  const maxScore = CATEGORY_MAX.salaryStability;
  let score = 0;
  const messages = [];

  if (employers.length > 0) {
    score += 5;
    messages.push(`זוהה מעסיק: ${employers[0]}${employers.length > 1 ? ` (+${employers.length - 1})` : ''}`);
  } else if (entries.length > 0) {
    messages.push('לא זוהה שם מעסיק בתלושים');
  }

  const netValues = entries
    .map(entry => enrichEntrySummary(entry.doc).netSalary)
    .filter(v => Number.isFinite(v) && v > 0);

  if (netValues.length < 2) {
    score += entries.length > 0 ? 8 : 0;
    if (entries.length > 0) {
      messages.push('אין מספיק חודשים להערכת יציבות שכר');
    }
  } else {
    const average = netValues.reduce((a, b) => a + b, 0) / netValues.length;
    let majorDrops = 0;
    let stableMonths = 0;

    for (let i = 1; i < netValues.length; i += 1) {
      const prev = netValues[i - 1];
      const curr = netValues[i];
      const change = (curr - prev) / prev;
      if (change <= -0.25) majorDrops += 1;
      if (Math.abs(change) <= 0.15) stableMonths += 1;
    }

    if (majorDrops === 0) {
      score += 15;
      messages.push('השכר נטו יציב יחסית לאורך השנה');
    } else {
      score += clamp(15 - majorDrops * 6, 5, 15);
      messages.push(`זוהתה ירידה חדה בשכר ב-${majorDrops} מעברים בין חודשים`);
    }

    if (stableMonths >= netValues.length - 2) {
      messages.push('רוב החודשים ללא שינוי חריג בשכר הנטו');
    }
  }

  const finalScore = clamp(score, 0, maxScore);
  return {
    key: 'salaryStability',
    name: 'יציבות שכר',
    score: finalScore,
    maxScore,
    status: statusFromRatio(finalScore / maxScore),
    messages,
  };
};

const scoreTaxReadiness = taxSummary => {
  const maxScore = CATEGORY_MAX.taxReadiness;
  let score = maxScore;
  const messages = [];
  const issueTypes = new Set((taxSummary.issues || []).map(issue => issue.type));

  if (issueTypes.has('missing_payslips')) {
    score -= 7;
    const issue = taxSummary.issues.find(i => i.type === 'missing_payslips');
    messages.push(issue?.message || 'חסרים תלושי שכר');
  } else {
    messages.push('כל חודשי השכר הנדרשים קיימים למס');
  }

  if (issueTypes.has('unusual_income_tax')) {
    score -= 4;
    messages.push('זוהו חודשים עם מס הכנסה חריג');
  }

  if (issueTypes.has('missing_form_106')) {
    score -= 6;
    messages.push('לא נמצא טופס 106 לשנה');
  } else if (taxSummary.summary?.totalSalaryDocuments > 0) {
    messages.push('טופס 106 קיים — מסייע למוכנות מס שנתית');
  }

  if (issueTypes.has('multiple_employers') && issueTypes.has('missing_form_106')) {
    score -= 3;
    messages.push('מספר מעסיקים ללא טופס 106 — מומלץ להשלים דיווח');
  }

  if (issueTypes.has('employer_change')) {
    score -= 2;
    messages.push('היה שינוי מעסיק במהלך השנה');
  }

  if (!issueTypes.size && taxSummary.summary?.totalSalaryDocuments > 0) {
    messages.push('לא זוהו חריגות מס משמעותיות');
  }

  const finalScore = clamp(score, 0, maxScore);
  return {
    key: 'taxReadiness',
    name: 'מוכנות מס',
    score: finalScore,
    maxScore,
    status: statusFromRatio(finalScore / maxScore),
    messages,
  };
};

const scorePensionConsistency = (taxSummary, entries) => {
  const maxScore = CATEGORY_MAX.pensionConsistency;
  let score = maxScore;
  const messages = [];
  const pensionIssue = (taxSummary.issues || []).find(
    issue => issue.type === 'missing_pension_contributions',
  );

  if (pensionIssue) {
    score -= 12;
    messages.push(pensionIssue.message);
  }

  if (!entries.length) {
    score = 0;
    messages.push('אין תלושים להערכת פנסיה');
  } else {
    let withEmployee = 0;
    let withEmployer = 0;
    entries.forEach(entry => {
      const summary = enrichEntrySummary(entry.doc);
      if (Number.isFinite(summary.pensionEmployee) && summary.pensionEmployee > 0) withEmployee += 1;
      if (Number.isFinite(summary.pensionEmployer) && summary.pensionEmployer > 0) withEmployer += 1;
    });

    if (withEmployee === entries.length) {
      messages.push('הפקדות פנסיה לעובד מדווחות בכל התלושים');
    } else {
      score -= 4;
      messages.push('חסרות הפקדות פנסיה לעובד בחלק מהחודשים');
    }

    if (withEmployer === entries.length) {
      messages.push('הפקדות פנסיה למעסיק מדווחות בכל התלושים');
    } else {
      score -= 4;
      messages.push('חסרות הפקדות פנסיה למעסיק בחלק מהחודשים');
    }
  }

  const finalScore = clamp(score, 0, maxScore);
  return {
    key: 'pensionConsistency',
    name: 'עקביות פנסיה',
    score: finalScore,
    maxScore,
    status: statusFromRatio(finalScore / maxScore),
    messages,
  };
};

const scoreRiskInsurance = (profile, recommendations, documents) => {
  const maxScore = CATEGORY_MAX.riskInsurance;
  let score = 0;
  const messages = [];

  const { answered, complete } = hasInsuranceProfileCompletion(profile);
  if (complete) {
    score += 5;
    messages.push('פרטי ביטוח מולאו בפרופיל');
  } else if (answered > 0) {
    score += 3;
    messages.push('חלק מפרטי הביטוח מולאו בפרופיל');
  } else {
    messages.push('מומלץ להשלים פרטי ביטוח באונבורדינג/הגדרות');
  }

  const critical = recommendations.filter(r => r.importance === 'critical');
  const high = recommendations.filter(r => r.importance === 'high');

  if (critical.length === 0) {
    score += 6;
    messages.push('אין המלצות ביטוח קריטיות פעילות');
  } else {
    score += clamp(6 - critical.length * 3, 0, 6);
    messages.push(`יש ${critical.length} המלצות ביטוח קריטיות`);
  }

  if (high.length === 0) {
    score += 2;
  } else {
    score += high.length <= 1 ? 1 : 0;
    messages.push(`יש ${high.length} המלצות ביטוח בעדיפות גבוהה`);
  }

  const duplicateDocs = countPossibleDuplicateDocuments(documents);
  if (duplicateDocs === 0) {
    score += 2;
    messages.push('לא זוהו כפילויות מסמכים');
  } else {
    messages.push(`זוהו ${duplicateDocs} מסמכים כפולים אפשריים`);
  }

  const finalScore = clamp(score, 0, maxScore);
  return {
    key: 'riskInsurance',
    name: 'מודעות סיכון וביטוח',
    score: finalScore,
    maxScore,
    status: statusFromRatio(finalScore / maxScore),
    messages,
  };
};

const buildTopActions = (categories, taxSummary, year) => {
  const actions = [];
  const byKey = Object.fromEntries(categories.map(c => [c.key, c]));

  if (byKey.documentCompleteness?.score < byKey.documentCompleteness?.maxScore * 0.85) {
    if (byKey.documentCompleteness.messages.some(m => m.includes('106'))) {
      actions.push({
        title: 'העלה טופס 106',
        description: 'טופס 106 יעזור להשלים את בדיקת המס השנתית.',
        actionUrl: '/documents',
      });
    }
    if (taxSummary.summary?.missingMonths?.length) {
      actions.push({
        title: 'העלה תלוש חסר',
        description: `חסרים תלושים לחודשים: ${formatMonthList(taxSummary.summary.missingMonths)}.`,
        actionUrl: '/documents',
      });
    }
  }

  const pensionIssue = (taxSummary.issues || []).find(i => i.type === 'missing_pension_contributions');
  if (pensionIssue) {
    actions.push({
      title: 'בדוק הפקדות פנסיה',
      description: 'בחלק מהתלושים חסרות הפקדות פנסיה — מומלץ לוודא מול המעסיק.',
      actionUrl: '/findings',
    });
  }

  if (byKey.taxReadiness?.score < 14) {
    actions.push({
      title: 'פתח עוזר מס',
      description: `סקירת מס מפורטת לשנת ${year}.`,
      actionUrl: '/tax-assistant',
    });
  }

  if (byKey.riskInsurance?.score < 10) {
    actions.push({
      title: 'בדוק המלצות ביטוח',
      description: 'יש פערים בכיסוי הביטוחי לפי הפרופיל שלך.',
      actionUrl: '/insurance',
    });
  }

  return actions.slice(0, 4);
};

const buildFinancialHealthScore = async (userId, yearInput) => {
  const year = Number(yearInput) || new Date().getFullYear();

  const [documents, taxSummary, profile, recommendations] = await Promise.all([
    Document.find({ user: userId }).sort('-uploadedAt').lean(),
    buildTaxAssistantSummary(userId, year),
    UserProfile.findOne({ user: userId }).lean(),
    Recommendation.find({ user: userId, status: 'active' }).lean(),
  ]);

  const { entries } = buildYearEntries(documents, year);
  const employers = [];
  const employerSet = new Set();
  entries.forEach(entry => {
    const name = getEmployerName(entry.doc);
    if (name && !employerSet.has(name)) {
      employerSet.add(name);
      employers.push(name);
    }
  });

  const yearStats = taxSummary.summary || {
    monthsPresent: [],
    missingMonths: [],
  };

  const categories = [
    scoreDocumentCompleteness(documents, yearStats, year),
    scoreSalaryStability(entries, employers),
    scoreTaxReadiness(taxSummary),
    scorePensionConsistency(taxSummary, entries),
    scoreRiskInsurance(profile, recommendations, documents),
  ];

  const score = clamp(
    categories.reduce((sum, cat) => sum + cat.score, 0),
    0,
    100,
  );
  const { level, label } = getScoreLevel(score);

  return {
    year,
    score,
    level,
    label,
    categories,
    topActions: buildTopActions(categories, taxSummary, year),
    disclaimer: DISCLAIMER,
  };
};

module.exports = {
  buildFinancialHealthScore,
  CATEGORY_MAX,
  DISCLAIMER,
};
