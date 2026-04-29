const { createExtractionResult } = require('./contracts/extractionResult.contract');

const HEBREW_MONTHS = Object.freeze({
  ינואר: '01',
  פברואר: '02',
  מרץ: '03',
  מרס: '03',
  אפריל: '04',
  מאי: '05',
  יוני: '06',
  יולי: '07',
  אוגוסט: '08',
  ספטמבר: '09',
  אוקטובר: '10',
  נובמבר: '11',
  דצמבר: '12',
});

function normalizeLines(rawText, rawLines) {
  if (Array.isArray(rawLines) && rawLines.length > 0) {
    return rawLines
      .map(line => (line == null ? '' : String(line).trim()))
      .filter(Boolean);
  }
  return String(rawText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function normalizeAmount(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[₪,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function makeEvidence(value, sourceText, confidence, reasoning, source) {
  return {
    value,
    sourceText: sourceText || null,
    confidence,
    reasoning: reasoning || null,
    source: source || null,
  };
}

function looksLikeLabelLine(line) {
  return /(שם|עובד|מעסיק|תעודת|זהות|תלוש|חודש|ברוטו|נטו|לתשלום|סכום\s*בבנק|סך|סה["'״]?כ)/i.test(line);
}

function hasPersonLetters(text) {
  return /[A-Za-z\u0590-\u05FF]/.test(String(text || ''));
}

function isLikelyAddressLike(text) {
  return /(רחוב|ת\.ד|דירה|קומה|כניסה|עיר|מיקוד|zip|street|st\.|ave|road|rd\.|city)/i.test(String(text || ''));
}

function isLikelyCompanyLike(text) {
  return /(בע["'״]?מ|חברה|חב['׳]?|Ltd|LLC|Inc|סניף|מחלקה|יחידה|מפעל|תאגיד)/i.test(String(text || ''));
}

function isLikelyPayrollTerms(text) {
  return /(תלוש|ברוטו|נטו|לתשלום|סכום\s*בבנק|מס|ביטוח|חודש|תקופה|ניכוי|תשלום)/i.test(
    String(text || ''),
  );
}

function extractPeriodMonth(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const hebrewMatch = line.match(
      /(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(20\d{2})/,
    );
    if (hebrewMatch) {
      const month = HEBREW_MONTHS[hebrewMatch[1]];
      return makeEvidence(
        `${hebrewMatch[2]}-${month}`,
        line,
        0.93,
        'Matched Hebrew month name and year.',
        { line: i + 1, method: 'regex-hebrew-month' },
      );
    }

    // Prefer "לחודש 02/2024" style if present.
    const periodContextMatch = line.match(/(?:לחודש|חודש|תקופה)[^\d]{0,10}(\d{2})[/-](20\d{2}|\d{2})/);
    if (periodContextMatch) {
      const mm = periodContextMatch[1];
      const yy = periodContextMatch[2].length === 2 ? `20${periodContextMatch[2]}` : periodContextMatch[2];
      return makeEvidence(
        `${yy}-${mm}`,
        line,
        0.9,
        'Matched explicit payslip period context.',
        { line: i + 1, method: 'regex-period-context' },
      );
    }

    const yyyymm = line.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])\b/);
    if (yyyymm) {
      return makeEvidence(
        `${yyyymm[1]}-${yyyymm[2]}`,
        line,
        0.84,
        'Matched YYYY-MM style period candidate.',
        { line: i + 1, method: 'regex-yyyy-mm' },
      );
    }

    const mmyy = line.match(/\b(0[1-9]|1[0-2])[/-](\d{2})\b/);
    if (mmyy && looksLikeLabelLine(line)) {
      return makeEvidence(
        `20${mmyy[2]}-${mmyy[1]}`,
        line,
        0.76,
        'Matched MM/YY with payslip-like context.',
        { line: i + 1, method: 'regex-mm-yy' },
      );
    }
  }
  return null;
}

function extractEmployeeIdFromLabeledContext(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const contextMatch = line.match(/(?:ת\.?\s*ז\.?|תעודת\s*זהות|מספר\s*זהות|ID)[:\s-]*(\d{7,9})\b/i);
    if (contextMatch) {
      return makeEvidence(
        contextMatch[1],
        line,
        0.94,
        'Matched employee id near identity label.',
        { line: i + 1, method: 'regex-id-context' },
      );
    }
  }
  return null;
}

function extractEmployeeIdFromStandaloneFallback(lines) {
  const idCandidates = [];
  const upperBound = Math.max(3, Math.ceil(lines.length * 0.45));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed) {
      // Strict standalone-ish candidate: avoid long garbage numbers and mixed noisy rows.
      const standaloneMatch = trimmed.match(/^\D{0,3}(\d{7,9})\D{0,3}$/);
      if (standaloneMatch) {
        const idValue = standaloneMatch[1];
        if (!/^0{7,9}$/.test(idValue)) {
          const prev = i > 0 ? lines[i - 1] : '';
          const next = i + 1 < lines.length ? lines[i + 1] : '';
          const nearbyText = `${prev} ${next}`.trim();
          const nearPersonLike = hasPersonLetters(prev) || hasPersonLetters(next);

          let score = 0.62; // baseline fallback
          if (i < upperBound) score += 0.08; // prefer upper document area
          if (nearPersonLike) score += 0.08;
          if (/(עובד|שם|employee|זהות)/i.test(nearbyText)) score += 0.06;
          if (isLikelyAddressLike(nearbyText) || isLikelyCompanyLike(nearbyText)) score -= 0.08;

          if (score >= 0.45) {
            idCandidates.push({
              value: idValue,
              sourceText: line,
              confidence: Math.max(0.45, Math.min(0.84, score)),
              reasoning:
                'Fallback standalone ID-like line, boosted by nearby person-like context and upper-page placement.',
              source: { line: i + 1, method: 'fallback-id-block' },
              score,
            });
          }
        }
      }
    }
  }

  if (idCandidates.length) {
    idCandidates.sort((a, b) => b.score - a.score);
    const best = idCandidates[0];
    return makeEvidence(best.value, best.sourceText, best.confidence, best.reasoning, best.source);
  }

  return null;
}

function isLikelyEmployeeName(candidate) {
  const c = String(candidate || '').trim();
  if (c.length < 2 || c.length > 60) return false;
  const digitsCount = (c.match(/\d/g) || []).length;
  if (digitsCount >= 3) return false;
  if (!hasPersonLetters(c)) return false;
  if (isLikelyAddressLike(c)) return false;
  if (isLikelyCompanyLike(c)) return false;
  if (/(תלוש|ברוטו|נטו|לתשלום|סך|סה["'״]?כ|מס|ביטוח|חודש|תקופה)/i.test(c)) return false;
  return true;
}

function cleanNameCandidate(candidate) {
  return String(candidate || '')
    .replace(/^[^A-Za-z\u0590-\u05FF]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMergedIdentityEvidence(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '').trim();
    if (line) {
      // Match text + optional separators + 7-9 trailing digits.
      const merged = line.match(/^(.{2,60}?)[\s:,-]*?(\d{7,9})$/);
      if (merged) {
        const rawName = cleanNameCandidate(merged[1]);
        const idValue = merged[2];
        const validId = /^[0-9]{7,9}$/.test(idValue) && !/^0{7,9}$/.test(idValue);
        const validName =
          Boolean(rawName) &&
          isLikelyEmployeeName(rawName) &&
          !isLikelyCompanyLike(rawName) &&
          !isLikelyAddressLike(rawName) &&
          !isLikelyPayrollTerms(rawName);

        if (validId && validName) {
          return {
            employee_name: makeEvidence(
              rawName,
              line,
              0.82,
              'Detected merged identity line (name text immediately followed by employee ID).',
              { line: i + 1, method: 'merged-name-id-line' },
            ),
            employee_id: makeEvidence(
              idValue,
              line,
              0.84,
              'Detected merged identity line (name text immediately followed by employee ID).',
              { line: i + 1, method: 'merged-name-id-line' },
            ),
          };
        }
      }
    }
  }

  return null;
}

function extractEmployeeName(lines, employeeIdEvidence, mergedIdentityEvidence) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const labeled = line.match(/(?:שם\s*עובד|Employee\s*Name|עובד)[:\s-]+([^\n]+)/i);
    if (labeled) {
      const name = cleanNameCandidate(labeled[1]);
      if (isLikelyEmployeeName(name)) {
        return makeEvidence(
          name,
          line,
          0.92,
          'Matched employee name label and plausible name text.',
          { line: i + 1, method: 'regex-name-label' },
        );
      }
    }
  }

  if (mergedIdentityEvidence && mergedIdentityEvidence.employee_name) {
    return mergedIdentityEvidence.employee_name;
  }

  if (employeeIdEvidence && employeeIdEvidence.value) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.includes(String(employeeIdEvidence.value))) {
        const nameFromSameLine = cleanNameCandidate(line.replace(String(employeeIdEvidence.value), ''));
        if (isLikelyEmployeeName(nameFromSameLine)) {
          return makeEvidence(
            nameFromSameLine,
            line,
            0.78,
            'Extracted candidate name from same line as employee id.',
            { line: i + 1, method: 'same-line-as-id' },
          );
        }
        if (i > 0) {
          const previous = cleanNameCandidate(lines[i - 1]);
          if (isLikelyEmployeeName(previous)) {
            return makeEvidence(
              previous,
              lines[i - 1],
              0.74,
              'Extracted candidate name from line above employee id.',
              { line: i, method: 'line-above-id' },
            );
          }
        }
        if (i + 1 < lines.length) {
          const next = cleanNameCandidate(lines[i + 1]);
          if (isLikelyEmployeeName(next)) {
            return makeEvidence(
              next,
              lines[i + 1],
              0.7,
              'Extracted candidate name from line below employee id.',
              { line: i + 2, method: 'line-below-id' },
            );
          }
        }
      }
    }
  }

  // Fallback identity block search: look for a person-like line adjacent to an unlabeled ID-like line.
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i].trim();
    const idish = current.match(/^\D{0,3}(\d{7,9})\D{0,3}$/);
    if (idish) {
      const around = [i - 1, i + 1].filter(idx => idx >= 0 && idx < lines.length);
      for (let j = 0; j < around.length; j += 1) {
        const idx = around[j];
        const candidate = cleanNameCandidate(lines[idx]);
        if (isLikelyEmployeeName(candidate)) {
          return makeEvidence(
            candidate,
            lines[idx],
            0.68,
            'Fallback identity block: person-like name adjacent to standalone ID-like line.',
            { line: idx + 1, method: 'fallback-id-neighbor-name' },
          );
        }
      }
    }
  }

  return null;
}

function extractAmountWithLabels(lines, labels, fieldKey) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (labels.some(label => label.test(line))) {
      const numbers = line.match(/\d[\d,]*(?:\.\d{1,2})?/g) || [];
      const parsed = numbers.map(normalizeAmount).filter(n => n != null && n > 0);
      if (parsed.length) {
        const value = Math.max(...parsed);
        const confidence = /[:]/.test(line) ? 0.92 : 0.88;
        return makeEvidence(
          value,
          line,
          confidence,
          `Matched ${fieldKey} label and selected strongest amount candidate on line.`,
          { line: i + 1, method: 'label-amount-line' },
        );
      }
    }
  }
  return null;
}

function isSkippableAmountScanLine(line) {
  const t = String(line || '').trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  if (/^(סניף|מחלקה|דף|תלוש|מכסה|יתרת|פתיחה|סגירה|זיכוי|ניצול|הודעות|ועדכונים)$/i.test(t)) return true;
  if (/^[A-Za-z\u0590-\u05FF\s"':()./-]{1,24}$/.test(t) && !/\d/.test(t)) return true;
  if (/^\d{1,2}$/.test(t)) return true;
  return false;
}

function rankAmountCandidates(candidates, fieldKey, scanBound) {
  if (!candidates.length) return [];

  return candidates.map((candidate) => {
    const label = candidate.labelLine;
    const localGroup = candidates.filter(c => c.labelIndex === candidate.labelIndex);
    const localMax = Math.max(...localGroup.map(c => c.value));
    const localMin = Math.min(...localGroup.map(c => c.value));
    const localMoneyGroup = localGroup.filter(c => c.value >= 1000 && c.value <= 50000);
    const localMaxMoney = localMoneyGroup.length ? Math.max(...localMoneyGroup.map(c => c.value)) : localMax;
    const localMinMoney = localMoneyGroup.length ? Math.min(...localMoneyGroup.map(c => c.value)) : localMin;
    const amountString = String(candidate.value);
    const candidateText = String(candidate.candidateLine || '');
    const mixedAlphaNumeric = /[A-Za-z\u0590-\u05FF]/.test(candidateText) && /\d/.test(candidateText);

    let score = 0.4;
    score += Math.max(0, (scanBound + 1 - candidate.distance) * 0.025);

    if (fieldKey === 'gross_total') {
      if (/ברוטו\s*שוטף|סך\s*תשלומים|סה["'״]?כ\s*תשלומים|gross/i.test(label)) score += 0.3;
      if (/ברוטושוטף|סכתשלומים|סה["'״]?כתשלומים/i.test(label)) score += 0.2;
      if (candidate.value >= 1000) score += 0.15;
      if (candidate.value > localMinMoney) score += 0.08;
      if (candidate.value === localMaxMoney) score += 0.5;
      if (candidate.value < 800) score -= 0.2;
      if (mixedAlphaNumeric) score -= 0.32;
      if (isLikelyCompanyLike(candidateText) || isLikelyAddressLike(candidateText)) score -= 0.4;
      if (/\d+\.\d{2}/.test(candidateText) || /,/.test(candidateText)) score += 0.06;
      else score -= 0.06;
      score += Math.min(0.2, candidate.value / 50000);
    } else if (fieldKey === 'net_payable') {
      if (/סכום\s*בבנק|נטו\s*לתשלום|שכר\s*נטו|net/i.test(label)) score += 0.3;
      if (candidate.value >= 1000) score += 0.15;
      // Prefer later candidates in bank/net flow (final payment tends to appear later in the block).
      score += Math.min(0.18, candidate.distance * 0.01);
      // In bank/net blocks, prefer values lower than local max (after deductions).
      if (candidate.value < localMaxMoney) score += 0.18;
      // Prefer the lower side among nearby candidates (net often lower than gross/total).
      if (candidate.value === localMinMoney) score += 0.28;
      if (/סכום\s*בבנק/i.test(label)) {
        if (candidate.value === localMinMoney) score += 0.2;
        else score -= 0.1;
      }
      if (candidate.value === localMaxMoney) score -= 0.2;
      if (/\.00$/.test(amountString)) score -= 0.02;
      if (candidate.value < 800) score -= 0.2;
      if (mixedAlphaNumeric) score -= 0.3;
      if (isLikelyCompanyLike(candidateText) || isLikelyAddressLike(candidateText)) score -= 0.4;
      if (/\d+\.\d{2}/.test(candidateText) || /,/.test(candidateText)) score += 0.05;
    }

    return { ...candidate, score };
  });
}

function extractNearbyAmountAfterLabel(lines, labels, fieldKey) {
  const SCAN_BOUND = fieldKey === 'net_payable' ? 40 : 28;
  const candidates = [];
  let scannedLineCount = 0;
  let scannedBlocks = 0;
  const strictBoundaryRx = /(תלוש:|סכומים\s*מצטברים|סך\s*נקודות\s*זיכוי)/i;

  for (let i = 0; i < lines.length; i += 1) {
    const labelLine = lines[i];
    if (!labels.some(label => label.test(labelLine))) {
      // eslint-disable-next-line no-continue
      continue;
    }
    scannedBlocks += 1;

    for (let d = 1; d <= SCAN_BOUND; d += 1) {
      const idx = i + d;
      if (idx >= lines.length) break;
      const candidateLine = lines[idx];
      scannedLineCount += 1;
        if (strictBoundaryRx.test(String(candidateLine || ''))) break;

      if (isSkippableAmountScanLine(candidateLine)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const numbers = candidateLine.match(/\d[\d,]*(?:\.\d{1,2})?/g) || [];
      const parsed = numbers
        .map(normalizeAmount)
        .filter(n => n != null && n >= 1000 && n <= 50000);

      parsed.forEach((value) => {
        candidates.push({
          value,
          labelLine,
          labelIndex: i,
          candidateLine,
          candidateIndex: idx,
          distance: d,
        });
      });
    }
  }

  const debugBase = {
    scannedLineCount,
    scannedBlocks,
    candidateCount: candidates.length,
  };

  if (!candidates.length) {
    return {
      evidence: null,
      debug: {
        ...debugBase,
        labelLine: null,
        selectedValue: null,
        selectedLine: null,
        skipReason: `no_${fieldKey}_candidate_in_scanned_block`,
      },
    };
  }

  const scored = rankAmountCandidates(candidates, fieldKey, SCAN_BOUND);
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const candidateDebug = scored
    .slice(0, 40)
    .map(c => ({ line: c.candidateIndex + 1, value: c.value, score: Number(c.score.toFixed(3)) }));

  return {
    evidence: makeEvidence(
      best.value,
      `${best.labelLine} | ${best.candidateLine}`,
      0.8,
      `Matched ${fieldKey} label line and ranked candidates across a forward scanned block.`,
      {
        line: best.candidateIndex + 1,
        method: 'label-block-amount-fallback-ranked',
        labelLine: best.labelIndex + 1,
        distance: best.distance,
        score: Number(best.score.toFixed(3)),
      },
    ),
    debug: {
      ...debugBase,
      labelLine: best.labelIndex + 1,
      selectedValue: best.value,
      selectedLine: best.candidateIndex + 1,
      candidates: candidateDebug,
      skipReason: null,
    },
  };
}

function reconcileNetAgainstGross(grossEvidence, netEvidence) {
  if (!grossEvidence || !netEvidence) {
    return netEvidence;
  }

  const gross = normalizeAmount(grossEvidence.value);
  const net = normalizeAmount(netEvidence.value);
  if (gross == null || net == null) {
    return netEvidence;
  }

  if (net <= gross) {
    return netEvidence;
  }

  // Keep behavior explicit/debuggable: down-rank invalid net>gross in fallback path.
  return makeEvidence(
    null,
    netEvidence.sourceText,
    0.6,
    'Nearby-line net candidate rejected because it is greater than gross candidate.',
    { ...(netEvidence.source || {}), rejected: 'net_greater_than_gross' },
  );
}

function buildCriticalExtraction(rawText, lines) {
  const fields = {};
  const debug = {
    rawLinesCount: lines.length,
    amountExtraction: {
      gross_total: { sameLineFound: false, nearbyFound: false, selectedMethod: null, skipReason: null },
      net_payable: { sameLineFound: false, nearbyFound: false, selectedMethod: null, skipReason: null },
    },
  };
  const periodEvidence = extractPeriodMonth(lines);
  const mergedIdentityEvidence = extractMergedIdentityEvidence(lines);
  const labeledEmployeeIdEvidence = extractEmployeeIdFromLabeledContext(lines);
  const standaloneEmployeeIdEvidence = extractEmployeeIdFromStandaloneFallback(lines);
  const employeeIdEvidence =
    labeledEmployeeIdEvidence ||
    (mergedIdentityEvidence && mergedIdentityEvidence.employee_id) ||
    standaloneEmployeeIdEvidence;
  const employeeNameEvidence = extractEmployeeName(
    lines,
    employeeIdEvidence,
    mergedIdentityEvidence,
  );
  const grossLabels = [
    /ברוטו\s*שוטף/i,
    /ברוטושוטף/i,
    /שכר\s*ברוטו/i,
    /סך\s*תשלומים/i,
    /סכתשלומים/i,
    /סך[-\s]?כל\s*התשלומים/i,
    /סה["'״]?כ\s*תשלומים/i,
    /סה["'״]?כתשלומים/i,
    /תשלומים/i,
    /סה["'״]?כ\s*תשלומים\s*שוטף/i,
    /Gross/i,
  ];
  const netLabels = [
    /נטו\s*לתשלום/i,
    /שכר\s*נטו/i,
    /סכום\s*בבנק/i,
    /לתשלום/i,
    /Net/i,
  ];
  const netNearbyLabels = [
    /נטו\s*לתשלום/i,
    /שכר\s*נטו/i,
    /סכום\s*בבנק/i,
    /Net/i,
  ];

  const grossSameLineEvidence = extractAmountWithLabels(lines, grossLabels, 'gross_total');
  const grossNearbyResult = grossSameLineEvidence
    ? { evidence: null, debug: { scannedLineCount: 0, scannedBlocks: 0, candidateCount: 0, labelLine: null, selectedValue: null, selectedLine: null, skipReason: null } }
    : extractNearbyAmountAfterLabel(lines, grossLabels, 'gross_total');
  const grossNearbyEvidence = grossNearbyResult.evidence;
  const grossEvidence = grossSameLineEvidence || grossNearbyEvidence;

  const netSameLineEvidence = extractAmountWithLabels(lines, netLabels, 'net_payable');
  const netNearbyResult = netSameLineEvidence
    ? { evidence: null, debug: { scannedLineCount: 0, scannedBlocks: 0, candidateCount: 0, labelLine: null, selectedValue: null, selectedLine: null, skipReason: null } }
    : extractNearbyAmountAfterLabel(lines, netNearbyLabels, 'net_payable');
  const netNearbyEvidence = netNearbyResult.evidence;
  const netEvidenceRaw = netSameLineEvidence || netNearbyEvidence;
  const netEvidence = reconcileNetAgainstGross(grossEvidence, netEvidenceRaw);

  debug.amountExtraction.gross_total.sameLineFound = Boolean(grossSameLineEvidence);
  debug.amountExtraction.gross_total.nearbyFound = Boolean(grossNearbyEvidence);
  debug.amountExtraction.gross_total.selectedMethod = grossEvidence?.source?.method || null;
  debug.amountExtraction.gross_total.labelLine = grossNearbyResult.debug?.labelLine || null;
  debug.amountExtraction.gross_total.scannedLineCount = grossNearbyResult.debug?.scannedLineCount || 0;
  debug.amountExtraction.gross_total.candidateCount = grossNearbyResult.debug?.candidateCount || 0;
  debug.amountExtraction.gross_total.selectedValue = grossNearbyResult.debug?.selectedValue ?? null;
  debug.amountExtraction.gross_total.selectedLine = grossNearbyResult.debug?.selectedLine || null;
  if (!grossEvidence) {
    debug.amountExtraction.gross_total.skipReason =
      grossNearbyResult.debug?.skipReason || 'no_gross_candidate_found';
  }

  debug.amountExtraction.net_payable.sameLineFound = Boolean(netSameLineEvidence);
  debug.amountExtraction.net_payable.nearbyFound = Boolean(netNearbyEvidence);
  debug.amountExtraction.net_payable.selectedMethod = netEvidence?.source?.method || null;
  debug.amountExtraction.net_payable.labelLine = netNearbyResult.debug?.labelLine || null;
  debug.amountExtraction.net_payable.scannedLineCount = netNearbyResult.debug?.scannedLineCount || 0;
  debug.amountExtraction.net_payable.candidateCount = netNearbyResult.debug?.candidateCount || 0;
  debug.amountExtraction.net_payable.selectedValue = netNearbyResult.debug?.selectedValue ?? null;
  debug.amountExtraction.net_payable.selectedLine = netNearbyResult.debug?.selectedLine || null;
  if (!netEvidenceRaw) {
    debug.amountExtraction.net_payable.skipReason =
      netNearbyResult.debug?.skipReason || 'no_net_candidate_found';
  } else if (netEvidence && netEvidence.value === null) {
    debug.amountExtraction.net_payable.skipReason = 'candidate_rejected_after_gross_comparison';
  } else if (!netEvidence) {
    debug.amountExtraction.net_payable.skipReason = 'net_candidate_missing_after_reconcile';
  }

  if (periodEvidence) fields.period_month = periodEvidence;
  if (employeeNameEvidence) fields.employee_name = employeeNameEvidence;
  if (employeeIdEvidence) fields.employee_id = employeeIdEvidence;
  if (grossEvidence) fields.gross_total = grossEvidence;
  if (netEvidence) fields.net_payable = netEvidence;

  return { fields, debug };
}

/**
 * Main v2 extraction entrypoint.
 * @param {Object} input
 * @param {string} input.rawText
 * @param {Object} [input.rawPayload]
 * @returns {Promise<{ meta: Object, fields: Object }>}
 */
async function extractPayslipFields(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('extractPayslipFields expects an input object.');
  }

  const rawText = typeof input.rawText === 'string' ? input.rawText : '';
  const lines = normalizeLines(rawText, input.rawLines);
  if (!lines.length) {
    throw new Error('extractPayslipFields requires non-empty rawText or rawLines.');
  }

  const extraction = buildCriticalExtraction(rawText, lines);

  return createExtractionResult(extraction.fields, {
    extractor: 'payslip-extractor-v2',
    version: '0.2.0-critical-fields',
    extractionMethod:
      typeof input.extractionMethod === 'string' ? input.extractionMethod : null,
    debug: extraction.debug,
  });
}

module.exports = {
  extractPayslipFields,
};
