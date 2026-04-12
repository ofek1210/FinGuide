const Document = require('../models/Document');
const { ValidationError } = require('../utils/appErrors');
const { normalizeAmount, parseNumericInput } = require('../utils/numeric');
const { buildLinearSavingsScenario } = require('../utils/linearSavingsForecast');

const parseNonNegativeNumber = (value, field, { required = true } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ValidationError('שגיאות בולידציה', [
        { field, message: `${field} הוא שדה חובה`, value },
      ]);
    }

    return undefined;
  }

  let parsed;
  try {
    parsed = parseNumericInput(value);
  } catch {
    throw new ValidationError('שגיאות בולידציה', [
      { field, message: `${field} חייב להיות מספר תקין`, value },
    ]);
  }

  if (parsed < 0) {
    throw new ValidationError('שגיאות בולידציה', [
      { field, message: `${field} חייב להיות גדול או שווה ל-0`, value: parsed },
    ]);
  }

  return normalizeAmount(parsed);
};

const parseIntegerAge = value => {
  let parsed;

  try {
    parsed = parseNumericInput(value);
  } catch {
    return Number.NaN;
  }

  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const normalizeSavingsForecastInput = rawInput => {
  const input = rawInput || {};
  const errors = [];

  const currentBalance = parseNonNegativeNumber(input.currentBalance, 'currentBalance');
  const adjustedMonthlyContribution = parseNonNegativeNumber(
    input.adjustedMonthlyContribution,
    'adjustedMonthlyContribution'
  );
  const currentMonthlyContribution = parseNonNegativeNumber(
    input.currentMonthlyContribution,
    'currentMonthlyContribution',
    { required: false }
  );

  const currentAge = parseIntegerAge(input.currentAge);
  const retirementAge = parseIntegerAge(input.retirementAge);

  if (!Number.isInteger(currentAge) || currentAge < 0) {
    errors.push({
      field: 'currentAge',
      message: 'currentAge חייב להיות גיל שלם גדול או שווה ל-0',
      value: input.currentAge,
    });
  }

  if (!Number.isInteger(retirementAge) || retirementAge < 0) {
    errors.push({
      field: 'retirementAge',
      message: 'retirementAge חייב להיות גיל שלם גדול או שווה ל-0',
      value: input.retirementAge,
    });
  }

  if (
    Number.isInteger(currentAge) &&
    Number.isInteger(retirementAge) &&
    retirementAge <= currentAge
  ) {
    errors.push({
      field: 'retirementAge',
      message: 'retirementAge חייב להיות גדול מ-currentAge',
      value: input.retirementAge,
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('שגיאות בולידציה', errors);
  }

  return {
    currentBalance,
    currentAge,
    retirementAge,
    adjustedMonthlyContribution,
    ...(currentMonthlyContribution !== undefined && { currentMonthlyContribution }),
  };
};

const readContributionValue = value => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  try {
    return normalizeAmount(parseNumericInput(value));
  } catch {
    return undefined;
  }
};

const deriveContributionFromDocument = document => {
  const pension = document?.analysisData?.contributions?.pension;

  if (!pension || typeof pension !== 'object') {
    return null;
  }

  const employee = readContributionValue(pension.employee);
  const employer = readContributionValue(pension.employer);
  const severance = readContributionValue(pension.severance);
  const values = [employee, employer, severance].filter(Number.isFinite);

  if (values.length === 0) {
    return null;
  }

  const monthlyContribution = normalizeAmount(
    values.reduce((sum, current) => sum + current, 0)
  );

  if (monthlyContribution <= 0) {
    return null;
  }

  const warnings = [];
  if ([employee, employer, severance].some(value => value === undefined)) {
    warnings.push('ההפקדה החודשית נגזרה מחלק מנתוני המסמך האחרון.');
  }

  return {
    monthlyContribution,
    warnings,
  };
};

const resolveCurrentMonthlyContribution = async ({
  userId,
  currentMonthlyContribution,
}) => {
  const documents = await Document.find({
    user: userId,
    status: 'completed',
  })
    .select('_id uploadedAt processedAt analysisData')
    .sort({ processedAt: -1, uploadedAt: -1, createdAt: -1 })
    .lean();

  const documentContribution = documents
    .map(document => {
      const derived = deriveContributionFromDocument(document);

      if (!derived) {
        return null;
      }

      return {
        monthlyContribution: derived.monthlyContribution,
        contributionSource: 'document',
        sourceDocumentId: document._id.toString(),
        warnings: derived.warnings,
      };
    })
    .find(Boolean);

  if (documentContribution) {
    return documentContribution;
  }

  if (currentMonthlyContribution !== undefined) {
    return {
      monthlyContribution: currentMonthlyContribution,
      contributionSource: 'manual',
      warnings: ['לא נמצא מסמך פנסיוני תקין. נעשה שימוש בהפקדה הידנית שהוזנה.'],
    };
  }

  throw new ValidationError('שגיאות בולידציה', [
    {
      field: 'currentMonthlyContribution',
      message:
        'לא נמצאה הפקדה חודשית תקינה במסמכים. יש להזין currentMonthlyContribution ידני.',
      value: currentMonthlyContribution,
    },
  ]);
};

const buildSavingsForecast = async ({ userId, input }) => {
  const normalizedInput = normalizeSavingsForecastInput(input);
  const resolvedContribution = await resolveCurrentMonthlyContribution({
    userId,
    currentMonthlyContribution: normalizedInput.currentMonthlyContribution,
  });

  return {
    currentScenario: buildLinearSavingsScenario({
      currentBalance: normalizedInput.currentBalance,
      currentAge: normalizedInput.currentAge,
      retirementAge: normalizedInput.retirementAge,
      monthlyContribution: resolvedContribution.monthlyContribution,
    }),
    adjustedScenario: buildLinearSavingsScenario({
      currentBalance: normalizedInput.currentBalance,
      currentAge: normalizedInput.currentAge,
      retirementAge: normalizedInput.retirementAge,
      monthlyContribution: normalizedInput.adjustedMonthlyContribution,
    }),
    meta: {
      contributionSource: resolvedContribution.contributionSource,
      ...(resolvedContribution.sourceDocumentId && {
        sourceDocumentId: resolvedContribution.sourceDocumentId,
      }),
      warnings: resolvedContribution.warnings,
    },
  };
};

module.exports = {
  buildSavingsForecast,
  buildLinearSavingsScenario,
  deriveContributionFromDocument,
  normalizeSavingsForecastInput,
  resolveCurrentMonthlyContribution,
};
