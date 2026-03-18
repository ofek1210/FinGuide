const User = require('../models/User');
const { ValidationError } = require('../utils/appErrors');

const isValidDateString = value => {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = new Date(s).getTime();
  return !Number.isNaN(t);
};

const buildResponse = user => ({
  success: true,
  data: {
    completed: Boolean(user.onboarding?.completed),
    completedAt: user.onboarding?.completedAt || null,
    data: user.onboarding?.data || {},
  },
});

const mergeOnboardingData = (existing, patch) => {
  const safeExisting = existing && typeof existing === 'object' ? existing : {};
  const safePatch = patch && typeof patch === 'object' ? patch : {};
  return { ...safeExisting, ...safePatch };
};

const validateDraft = data => {
  // Draft: validate only provided fields (types/ranges), no required-ness.
  const errors = [];
  if (data.salaryType != null && !['global', 'hourly'].includes(data.salaryType)) {
    errors.push({ field: 'salaryType', message: 'Invalid salaryType' });
  }
  const numeric = [
    ['expectedMonthlyGross', 0, 500000],
    ['hourlyRate', 0, 5000],
    ['expectedMonthlyHours', 0, 400],
    ['jobPercentage', 0, 100],
  ];
  numeric.forEach(([key, min, max]) => {
    if (data[key] == null) return;
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) {
      errors.push({ field: key, message: 'Must be a number' });
      return;
    }
    if (data[key] < min || data[key] > max) {
      errors.push({ field: key, message: `Must be between ${min} and ${max}` });
    }
  });
  const bools = [
    'isPrimaryJob',
    'hasMultipleEmployers',
    'hasPension',
    'hasStudyFund',
  ];
  bools.forEach(key => {
    if (data[key] == null) return;
    if (typeof data[key] !== 'boolean') {
      errors.push({ field: key, message: 'Must be boolean' });
    }
  });
  if (data.employmentStartDate != null && !isValidDateString(data.employmentStartDate)) {
    errors.push({ field: 'employmentStartDate', message: 'Must be YYYY-MM-DD' });
  }

  if (errors.length) {
    throw new ValidationError('שגיאות בולידציה', errors);
  }
};

const validateComplete = data => {
  const errors = [];
  const requiredAlways = [
    'salaryType',
    'jobPercentage',
    'isPrimaryJob',
    'employmentStartDate',
    'hasPension',
    'hasStudyFund',
    'hasMultipleEmployers',
  ];
  requiredAlways.forEach(key => {
    if (data[key] == null) {
      errors.push({ field: key, message: 'Required' });
    }
  });

  if (data.salaryType === 'global') {
    if (data.expectedMonthlyGross == null) {
      errors.push({ field: 'expectedMonthlyGross', message: 'Required for global salaryType' });
    }
  }

  if (data.salaryType === 'hourly') {
    if (data.hourlyRate == null) {
      errors.push({ field: 'hourlyRate', message: 'Required for hourly salaryType' });
    }
    if (data.expectedMonthlyHours == null) {
      errors.push({ field: 'expectedMonthlyHours', message: 'Required for hourly salaryType' });
    }
  }

  // Reuse draft validation for type/range checks too.
  if (errors.length) {
    throw new ValidationError('חסרים פרטים כדי לסיים', errors);
  }
};

exports.getOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('onboarding');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }
    return res.status(200).json(buildResponse(user));
  } catch (err) {
    return next(err);
  }
};

exports.updateOnboarding = async (req, res, next) => {
  try {
    const patch = req.body?.data;
    if (!patch || typeof patch !== 'object') {
      throw new ValidationError('שגיאות בולידציה', [{ field: 'data', message: 'Must be an object' }]);
    }

    validateDraft(patch);

    const user = await User.findById(req.user._id).select('onboarding');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }

    const merged = mergeOnboardingData(user.onboarding?.data, patch);
    user.onboarding = user.onboarding || {};
    user.onboarding.data = merged;
    user.onboarding.updatedAt = new Date();
    await user.save();

    return res.status(200).json(buildResponse(user));
  } catch (err) {
    return next(err);
  }
};

exports.completeOnboarding = async (req, res, next) => {
  try {
    const patch = req.body?.data;
    if (patch != null && typeof patch !== 'object') {
      throw new ValidationError('שגיאות בולידציה', [{ field: 'data', message: 'Must be an object' }]);
    }

    if (patch) {
      validateDraft(patch);
    }

    const user = await User.findById(req.user._id).select('onboarding');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }

    const merged = mergeOnboardingData(user.onboarding?.data, patch || {});

    // Validate completion requirements.
    validateComplete(merged);
    validateDraft(merged);

    user.onboarding = user.onboarding || {};
    user.onboarding.data = merged;
    user.onboarding.completed = true;
    user.onboarding.completedAt = new Date();
    user.onboarding.updatedAt = new Date();
    await user.save();

    return res.status(200).json(buildResponse(user));
  } catch (err) {
    return next(err);
  }
};

exports.getOnboardingStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('onboarding.completed');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }
    return res.status(200).json({
      success: true,
      data: { completed: Boolean(user.onboarding?.completed) },
    });
  } catch (err) {
    return next(err);
  }
};

