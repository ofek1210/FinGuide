const {
  COMPANY_HINT_REGEX,
  EMPLOYER_CONTEXT_REGEX,
  MONTH_NAME_HEADER_REGEX,
  match1,
} = require('./payslipOcrShared');
const { pushCandidate, sortCandidatesByScore } = require('./payslipOcrResolver');

const EMPLOYEE_LABEL_REGEX = /(?:שם\s+עובד|שם\s+העובד|Employee\s+Name)[:\s-]+([^\n]+)/i;
const EMPLOYER_LABEL_REGEX = /(?:שם\s+מעסיק|שם\s+מעביד|שם\s+החברה|Employer\s+Name)[:\s-]+([^\n]+)/i;
const EMPLOYEE_ID_LABEL_REGEX = /(?:ת\.?\s*ז\.?|תעודת\s+זהות|מספר\s+זהות|ID)[:\s-]*(\d{7,9})/i;
const CONTRIBUTION_CONTEXT_REGEX =
  /(?:קרן\s*השתלמות|שכר\s*לקצבה|תגמול|תגמולים|פיצוי|פיצויים|הפרשת\s*מעסיק|ניכוי\s*עובד)/i;
// Michpal format: "חברה: NNN - Company Name בע"מ"
const MICHPAL_COMPANY_REGEX = /חברה:\s*\d+\s*-\s*(.+?)$/;

function normalizeEmployeeName(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeEmployerName(value) {
  return String(value)
    // Strip Unicode bidi control characters (common in Chilan/Check Point PDFs)
    .replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, '')
    .replace(/\s+/g, ' ')
    // Normalise all OCR variants of בע"מ: בע'ימ, בעיימ, בע''מ, בעימ → בע"מ
    .replace(/בע["']{0,2}[י]{0,2}מ/g, 'בע"מ')
    // Strip trailing address (starts with comma)
    .replace(/\s*,\s*.+$/, '')
    .trim();
}

/** Bare Hebrew label words that should never be treated as employer names */
const EMPLOYER_LABEL_ONLY_RE = /^(?:מעסיק|מעביד|חברה|employer|company)$/i;

function isValidEmployeeName(value) {
  const normalized = normalizeEmployeeName(value);
  if (!normalized || normalized.length < 2 || normalized.length > 60) {
    return false;
  }
  if (/\d/.test(normalized) || COMPANY_HINT_REGEX.test(normalized) || MONTH_NAME_HEADER_REGEX.test(normalized)) {
    return false;
  }
  return true;
}

function isValidEmployerName(value) {
  const normalized = normalizeEmployerName(value);
  if (!normalized || normalized.length < 3 || normalized.length > 100) {
    return false;
  }
  if (/^\d+$/.test(normalized) || MONTH_NAME_HEADER_REGEX.test(normalized)) {
    return false;
  }
  // Reject bare label words (e.g. מעסיק appearing as a column header)
  if (EMPLOYER_LABEL_ONLY_RE.test(normalized)) {
    return false;
  }
  // Reject seniority/tenure lines
  if (/ותק\s*אצל/.test(normalized)) {
    return false;
  }
  // Reject payslip-processor credit lines (Chilan)
  if (/עיבוד\s*וביצוע/.test(normalized)) {
    return false;
  }
  // Reject tax filing identifier lines (Chilan format)
  if (/תיק\s+ניכויים/.test(normalized)) {
    return false;
  }
  if (/חברה:\s*\d/.test(normalized)) {
    return false;
  }
  return true;
}

function isValidEmployeeId(value) {
  return /^\d{7,9}$/.test(String(value || '').trim());
}

// Israeli teudat-zehut checksum: 9 digits, weighted [1,2,1,2,...], digit-sum
// of each product, total divisible by 10. Helps distinguish a real ID
// (322819145 ✓) from a 7-digit ZIP code that just happens to be nearby.
function isLikelyIsraeliId(value) {
  const digits = String(value || '').trim();
  if (!/^\d{9}$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < 9; i += 1) {
    const product = Number(digits[i]) * ((i % 2) + 1);
    total += product > 9 ? Math.floor(product / 10) + (product % 10) : product;
  }
  return total % 10 === 0;
}

/**
 * When the same employee_id value appears in multiple candidate rows (e.g.
 * once on the header line and again next to the ID label), it is far more
 * likely the real ID than a one-off ZIP/tax-file token. Boost duplicates so
 * they cross the 0.4 resolution threshold even when the original heuristics
 * scored them at 0.30–0.34.
 */
function applyEmployeeIdConsistencyBoost(candidates) {
  if (!Array.isArray(candidates) || candidates.length < 2) return;
  const occurrences = new Map();
  for (const candidate of candidates) {
    if (!candidate || !isValidEmployeeId(candidate.value)) continue;
    occurrences.set(candidate.value, (occurrences.get(candidate.value) || 0) + 1);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const count = occurrences.get(candidate.value) || 0;
    let boost = 0;
    if (count >= 2) boost += 0.16;
    if (isLikelyIsraeliId(candidate.value)) boost += 0.08;
    if (boost > 0) candidate.score = Math.min(1, candidate.score + boost);
  }
}

function isEmployerContextLine(line) {
  return EMPLOYER_CONTEXT_REGEX.test(String(line)) || COMPANY_HINT_REGEX.test(String(line));
}

function isContributionContextEntry(entry) {
  if (!entry) {
    return false;
  }

  if (entry.sectionHints?.includes('contributions')) {
    return true;
  }

  return CONTRIBUTION_CONTEXT_REGEX.test(String(entry.raw || entry));
}

function collectPartyCandidates(context) {
  const store = {};
  const full = context.fullText;

  for (const entry of context.lines) {
    const contributionContext = isContributionContextEntry(entry);
    const employeeName = match1(entry.raw, EMPLOYEE_LABEL_REGEX);
    if (employeeName && isValidEmployeeName(employeeName) && !contributionContext) {
      pushCandidate(store, 'employee_name', normalizeEmployeeName(employeeName), {
        source: 'employee_name_label',
        lineIndex: entry.index,
        score: 0.98,
        reason: 'Matched employee name from an explicit label.',
        section: entry.primarySection || 'identity',
        evidenceCategory: 'label',
      });
    }

    const employerName = match1(entry.raw, EMPLOYER_LABEL_REGEX);
    if (employerName && isValidEmployerName(employerName)) {
      pushCandidate(store, 'employer_name', normalizeEmployerName(employerName), {
        source: 'employer_name_label',
        lineIndex: entry.index,
        score: 0.98,
        reason: 'Matched employer name from an explicit label.',
        section: entry.primarySection || 'identity',
        evidenceCategory: 'label',
      });
    }

    if (!isEmployerContextLine(entry.raw) && !contributionContext) {
      const employeeId = match1(entry.raw, EMPLOYEE_ID_LABEL_REGEX);
      if (employeeId && isValidEmployeeId(employeeId)) {
        pushCandidate(store, 'employee_id', employeeId, {
          source: 'employee_id_label',
          lineIndex: entry.index,
          score: 0.99,
          reason: 'Matched employee ID from an explicit label.',
          section: entry.primarySection || 'identity',
          evidenceCategory: 'label',
        });
      }
    }

    if (isEmployerContextLine(entry.raw)) {
      const companyLine = normalizeEmployerName(entry.raw);
      if (isValidEmployerName(companyLine)) {
        // Prefer lines that actually contain a company suffix (בע"מ, Ltd) over generic label words
        const hasCompanySuffix = COMPANY_HINT_REGEX.test(companyLine);
        pushCandidate(store, 'employer_name', companyLine, {
          source: 'company_suffix_fallback',
          lineIndex: entry.index,
          score: hasCompanySuffix ? 0.72 : 0.56,
          reason: 'Fallback employer name based on a company suffix.',
          section: 'identity',
          evidenceCategory: 'fallback',
        });
      }
      continue;
    }

    if (contributionContext) {
      continue;
    }

    const sameLine = entry.raw.match(/([A-Za-zא-ת][A-Za-zא-ת\s'"-]{2,40})\s*(\d{7,9})\b/);
    if (sameLine && isValidEmployeeName(sameLine[1]) && isValidEmployeeId(sameLine[2])) {
      pushCandidate(store, 'employee_name', normalizeEmployeeName(sameLine[1]), {
        source: 'heuristic_name_id_same_line',
        lineIndex: entry.index,
        score: 0.34,
        reason: 'Low-confidence name+ID fallback from the same line.',
        section: 'identity',
        evidenceCategory: 'heuristic',
      });
      pushCandidate(store, 'employee_id', sameLine[2], {
        source: 'heuristic_name_id_same_line',
        lineIndex: entry.index,
        score: 0.34,
        reason: 'Low-confidence name+ID fallback from the same line.',
        section: 'identity',
        evidenceCategory: 'heuristic',
      });
    }

    // Chilan/Check Point format: "בלנקי אמילי 23370" or "בלנקי אמילי23370" — name + 4-6 digit employee number
    if (!sameLine) {
      const chilanLine = entry.raw.match(/^([\u05D0-\u05FA]+\s+[\u05D0-\u05FA]+)\s*(\d{4,6})\s*$/);
      if (chilanLine && isValidEmployeeName(chilanLine[1])) {
        pushCandidate(store, 'employee_name', normalizeEmployeeName(chilanLine[1]), {
          source: 'heuristic_chilan_name_empnum',
          lineIndex: entry.index,
          score: 0.40,
          reason: 'Hebrew name followed by a short employee number (Chilan/Check Point format).',
          section: 'identity',
          evidenceCategory: 'heuristic',
        });
      }
    }

    const nextLine = context.lines[entry.index + 1]?.raw;
    if (
      nextLine &&
      !isEmployerContextLine(nextLine) &&
      isValidEmployeeName(entry.raw) &&
      isValidEmployeeId(nextLine)
    ) {
      pushCandidate(store, 'employee_name', normalizeEmployeeName(entry.raw), {
        source: 'heuristic_name_before_id',
        lineIndex: entry.index,
        score: 0.3,
        reason: 'Low-confidence name+ID fallback from adjacent lines.',
        section: 'identity',
        evidenceCategory: 'heuristic',
      });
      pushCandidate(store, 'employee_id', nextLine.trim(), {
        source: 'heuristic_name_before_id',
        lineIndex: entry.index + 1,
        score: 0.3,
        reason: 'Low-confidence name+ID fallback from adjacent lines.',
        section: 'identity',
        evidenceCategory: 'heuristic',
      });
    }
  }

  const idNearIdentityLabel = full.match(
    /(?:ת\.?\s*ז\.?|תעודת\s+זהות|מספר\s+זהות|ID)[:\s-]*[\s\S]{0,40}?(\d{7,9})/i,
  );
  if (idNearIdentityLabel && isValidEmployeeId(idNearIdentityLabel[1])) {
    pushCandidate(store, 'employee_id', idNearIdentityLabel[1], {
      source: 'employee_id_near_label',
      score: 0.9,
      reason: 'Matched employee ID near an identity label.',
      section: 'identity',
      evidenceCategory: 'label_proximity',
    });
  }

  // ---- Michpal: "לכבוד\nFirstName LastName\nAddress" pattern ----
  for (let i = 0; i < context.lines.length; i += 1) {
    const entry = context.lines[i];
    if (/לכבוד/.test(entry.raw)) {
      const nameLine = context.lines[i + 1];
      if (nameLine && isValidEmployeeName(nameLine.raw)) {
        pushCandidate(store, 'employee_name', normalizeEmployeeName(nameLine.raw), {
          source: 'michpal_lekhavod_pattern',
          lineIndex: i + 1,
          score: 0.88,
          reason: 'Matched employee name after לכבוד (Michpal format).',
          section: 'identity',
          evidenceCategory: 'label',
        });
      }
      break;
    }
  }

  // ---- Michpal: "חברה: NNN - Company Name בע"מ" from תיק ניכויים line ----
  for (const entry of context.lines) {
    const michpalMatch = entry.raw.match(MICHPAL_COMPANY_REGEX);
    if (michpalMatch) {
      const companyName = normalizeEmployerName(michpalMatch[1]);
      if (isValidEmployerName(companyName)) {
        pushCandidate(store, 'employer_name', companyName, {
          source: 'michpal_company_pattern',
          lineIndex: entry.index,
          score: 0.92,
          reason: 'Matched employer name from Michpal חברה: NNN - Name pattern.',
          section: 'identity',
          evidenceCategory: 'label',
        });
      }
      break;
    }
  }

  // ---- שם החברה label ----
  const companyNameMatch = full.match(/שם\s+החברה\s*[:\s]+([^\n]+)/i);
  if (companyNameMatch) {
    const companyName = normalizeEmployerName(companyNameMatch[1]);
    if (isValidEmployerName(companyName)) {
      pushCandidate(store, 'employer_name', companyName, {
        source: 'company_name_label',
        score: 0.95,
        reason: 'Matched employer name from שם החברה label.',
        section: 'identity',
        evidenceCategory: 'label',
      });
    }
  }

  return store;
}

function resolvePartyCandidates(store) {
  applyEmployeeIdConsistencyBoost(store.employee_id);

  const employeeName = sortCandidatesByScore(store.employee_name).find(
    candidate => candidate.score >= 0.4 && isValidEmployeeName(candidate.value),
  );
  const employerName = sortCandidatesByScore(store.employer_name).find(
    candidate => candidate.score >= 0.45 && isValidEmployerName(candidate.value),
  );
  const employeeId = sortCandidatesByScore(store.employee_id).find(
    candidate => candidate.score >= 0.4 && isValidEmployeeId(candidate.value),
  );

  return {
    employee_name: employeeName,
    employer_name: employerName,
    employee_id: employeeId,
  };
}

module.exports = {
  applyEmployeeIdConsistencyBoost,
  collectPartyCandidates,
  isLikelyIsraeliId,
  isValidEmployeeId,
  isValidEmployeeName,
  isValidEmployerName,
  normalizeEmployeeName,
  normalizeEmployerName,
  resolvePartyCandidates,
};
