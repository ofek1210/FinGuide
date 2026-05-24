const UserProfile = require('../models/UserProfile');
const { ValidationError } = require('../utils/appErrors');
const {
  validateDraft,
  normalizeLegacyPatch,
  mergeProfilePatch,
} = require('../utils/onboardingValidation');

const buildProfileResponse = profile => {
  const plain = profile.toObject ? profile.toObject() : profile;
  return {
    success: true,
    data: {
      personal: plain.personal || {},
      financial: plain.financial || {},
      assets: plain.assets || {},
      insurance: plain.insurance || {},
      retirement: plain.retirement || {},
      employment: plain.employment || {},
      completedSteps: plain.completedSteps || [],
      completedAt: plain.completedAt || null,
      updatedAt: plain.updatedAt || null,
    },
  };
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await UserProfile.findOrCreateForUser(req.user._id);
    return res.status(200).json(buildProfileResponse(profile));
  } catch (err) {
    return next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const rawPatch = req.body?.data ?? req.body;
    if (rawPatch == null || typeof rawPatch !== 'object') {
      throw new ValidationError('שגיאות בולידציה', [
        { field: 'data', message: 'Must be an object' },
      ]);
    }
    const patch = normalizeLegacyPatch(rawPatch);
    validateDraft(patch);

    const profile = await UserProfile.findOrCreateForUser(req.user._id);
    mergeProfilePatch(profile, patch);
    await profile.save();

    setImmediate(() => {
      const { run: runRecommendations } = require('../services/insuranceRecommender');
      runRecommendations(req.user._id).catch(err =>
        console.error('[profile] recommendation refresh failed', err),
      );
    });

    return res.status(200).json(buildProfileResponse(profile));
  } catch (err) {
    return next(err);
  }
};
