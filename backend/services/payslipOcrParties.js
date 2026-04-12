const {
  COMPANY_HINT_REGEX,
  EMPLOYER_CONTEXT_REGEX,
  MONTH_NAME_HEADER_REGEX,
  match1,
} = require('./payslipOcrShared');
const { pushCandidate, sortCandidatesByScore } = require('./payslipOcrResolver');

const EMPLOYEE_LABEL_REGEX = /(?:שם\s+עובד|שם\s+העובד|Employee\s+Name)[:\s-]+([^\n]+)/i;
const EMPLOYER_LABEL_REGEX = /(?:שם\s+מעסיק|שם\s+מעביד|Employer\s+Name)[:\s-]+([^\n]+)/i;
const EMPLOYEE_ID_LABEL_REGEX = /(?:ת\.?\s*ז\.?|תעודת\s+זהות|מספר\s+זהות|ID)[:\s-]*(\d{7,9})/i;
const CONTRIBUTION_CONTEXT_REGEX =
  /(?:קרן\s*השתלמות|שכר\s*לקצבה|תגמול|תגמולים|פיצוי|פיצויים|הפרשת\s*מעסיק|ניכוי\s*עובד)/i;

function normalizeEmployeeName(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeEmployerName(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

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
  if (!normalized || normalized.length < 2 || normalized.length > 100) {
    return false;
  }
  if (/^\d+$/.test(normalized) || MONTH_NAME_HEADER_REGEX.test(normalized)) {
    return false;
  }
  return true;
}

function isValidEmployeeId(value) {
  return /^\d{7,9}$/.test(String(value || '').trim());
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
        pushCandidate(store, 'employer_name', companyLine, {
          source: 'company_suffix_fallback',
          lineIndex: entry.index,
          score: 0.56,
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

  return store;
}

function resolvePartyCandidates(store) {
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
  collectPartyCandidates,
  isValidEmployeeId,
  isValidEmployeeName,
  isValidEmployerName,
  normalizeEmployeeName,
  normalizeEmployerName,
  resolvePartyCandidates,
};
