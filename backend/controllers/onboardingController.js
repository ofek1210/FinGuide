const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const { ValidationError } = require('../utils/appErrors');
const {
  validateDraft,
  validateComplete,
  normalizeLegacyPatch,
  mergeProfilePatch,
} = require('../utils/onboardingValidation');

/**
 * Build a flat object that is JSON-friendly, exposing the new sectioned
 * shape but also keeping the legacy flat keys so older clients keep working.
 */
const buildProfilePayload = profile => {
  const plain = profile.toObject ? profile.toObject() : profile;
  const sections = {
    personal: plain.personal || {},
    financial: plain.financial || {},
    assets: plain.assets || {},
    insurance: plain.insurance || {},
    retirement: plain.retirement || {},
    employment: plain.employment || {},
  };
  return {
    ...sections,
    legacy: profile.toLegacyOnboardingData ? profile.toLegacyOnboardingData() : {},
    completedSteps: plain.completedSteps || [],
    completedAt: plain.completedAt || null,
  };
};

const buildResponse = (user, profile) => ({
  success: true,
  data: {
    completed: Boolean(user.onboarding?.completed),
    completedAt: user.onboarding?.completedAt || profile.completedAt || null,
    data: buildProfilePayload(profile),
  },
});

exports.getOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('onboarding');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }
    const profile = await UserProfile.findOrCreateForUser(user._id);
    return res.status(200).json(buildResponse(user, profile));
  } catch (err) {
    return next(err);
  }
};

exports.updateOnboarding = async (req, res, next) => {
  try {
    const rawPatch = req.body?.data;
    if (rawPatch == null || typeof rawPatch !== 'object') {
      throw new ValidationError('שגיאות בולידציה', [
        { field: 'data', message: 'Must be an object' },
      ]);
    }

    const patch = normalizeLegacyPatch(rawPatch);
    validateDraft(patch);

    const user = await User.findById(req.user._id).select('onboarding');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }

    const profile = await UserProfile.findOrCreateForUser(user._id);
    mergeProfilePatch(profile, patch);

    if (Array.isArray(req.body?.completedSteps)) {
      const newSteps = req.body.completedSteps.filter(s => typeof s === 'string');
      const merged = Array.from(new Set([...(profile.completedSteps || []), ...newSteps]));
      profile.completedSteps = merged;
    }

    await profile.save();
    return res.status(200).json(buildResponse(user, profile));
  } catch (err) {
    return next(err);
  }
};

exports.completeOnboarding = async (req, res, next) => {
  try {
    const rawPatch = req.body?.data;
    if (rawPatch != null && typeof rawPatch !== 'object') {
      throw new ValidationError('שגיאות בולידציה', [
        { field: 'data', message: 'Must be an object' },
      ]);
    }

    const patch = rawPatch ? normalizeLegacyPatch(rawPatch) : null;
    if (patch) {
      validateDraft(patch);
    }

    const user = await User.findById(req.user._id).select('onboarding');
    if (!user) {
      return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
    }

    const profile = await UserProfile.findOrCreateForUser(user._id);
    if (patch) {
      mergeProfilePatch(profile, patch);
    }

    const merged = profile.toObject ? profile.toObject() : profile;
    validateComplete(merged);

    profile.completedAt = profile.completedAt || new Date();
    await profile.save();

    user.onboarding = user.onboarding || {};
    user.onboarding.completed = true;
    user.onboarding.completedAt = new Date();
    user.onboarding.updatedAt = new Date();
    // Mirror a minimal slice into user.onboarding.data so older code that still
    // reads from User.onboarding.data keeps seeing data.
    user.onboarding.data = profile.toLegacyOnboardingData();
    await user.save();

    setImmediate(() => {
      const { run: runRecommendations } = require('../services/insuranceRecommender');
      const { runFullAnalysis } = require('../services/insightsEngine');
      runFullAnalysis(user._id)
        .then(() => runRecommendations(user._id))
        .catch(err => console.error('[onboarding] post-complete analysis failed', err));
    });

    return res.status(200).json(buildResponse(user, profile));
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
