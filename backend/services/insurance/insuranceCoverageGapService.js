'use strict';

const { hasDisabilityCoverage } = require('../pensionCoverageAnalysisService');

const DISABILITY_GAP_MESSAGE =
  'לא זוהה כיסוי אובדן כושר עבודה בקובץ הביטוח שהועלה. כדאי לבדוק אם הכיסוי קיים בקרן הפנסיה, בביטוח מנהלים או דרך המעסיק.';

/**
 * Detect coverage gaps with pension / employer cross-check for disability.
 */
function analyzeCoverageGaps(profileDTO, aggregatedPolicies, options = {}) {
  const coveredTypes = new Set((aggregatedPolicies || []).map(p => p.type));
  const missing = [];
  const flags = [];
  const gapFindings = [];

  const ins = profileDTO?.insurance || profileDTO?.profile || {};
  const assets = profileDTO?.assets || {};
  const personal = profileDTO?.personal || {};
  const pensionFunds = options.pensionFunds || [];

  if (personal.maritalStatus === 'married' && ins.hasLifeInsurance === false && !coveredTypes.has('life')) {
    missing.push('life');
  }

  const hasHarDisability = coveredTypes.has('disability');
  const hasProfileDisability = ins.hasDisabilityInsurance === true;
  const hasPensionDisability = pensionFunds.some(f =>
    hasDisabilityCoverage(f.insuranceCoverages || []),
  );

  if (!hasHarDisability && !hasProfileDisability && !hasPensionDisability) {
    gapFindings.push({
      type: 'disability',
      status: 'unverified_in_file',
      messageHe: DISABILITY_GAP_MESSAGE,
      missingInputs: ['pensionDisabilityCheck', 'employerArrangement'],
      confidence: 'low',
    });
    flags.push({
      code: 'disability_unverified',
      urgency: 'medium',
      label: DISABILITY_GAP_MESSAGE,
    });
  }

  if (assets.ownsApartment && !ins.hasApartmentInsurance && !coveredTypes.has('apartment')) {
    missing.push('apartment');
  }

  if (!ins.hasHealthInsurance && !coveredTypes.has('health') && !coveredTypes.has('critical_illness')) {
    missing.push('health_supplement');
  }

  const urgency = missing.includes('apartment') || gapFindings.some(g => g.type === 'disability')
    ? 'medium'
    : missing.length ? 'low' : 'low';

  return {
    missingTypes: missing,
    gapFindings,
    urgency,
    flags,
    disabilityCheckedSources: {
      harFile: hasHarDisability,
      profile: hasProfileDisability,
      pension: hasPensionDisability,
    },
  };
}

module.exports = {
  analyzeCoverageGaps,
  DISABILITY_GAP_MESSAGE,
};
