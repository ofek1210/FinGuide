const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const { isValidEmployeeName, normalizeEmployeeName } = require('../services/payslipOcrParties');

function looksLikeHebrewDisplayName(value) {
  const normalized = normalizeEmployeeName(value);
  if (!normalized || !isValidEmployeeName(normalized)) {
    return false;
  }
  return /[\u0590-\u05FF]/.test(normalized);
}

/**
 * Prefer the Hebrew display name from profile settings over login/username text.
 */
async function getExpectedEmployeeNameForUser(userId) {
  if (!userId) {
    return null;
  }

  const [profile, user] = await Promise.all([
    UserProfile.findOne({ user: userId }).select('personal.fullName').lean(),
    User.findById(userId).select('name').lean(),
  ]);

  const fromProfile = profile?.personal?.fullName?.trim();
  if (looksLikeHebrewDisplayName(fromProfile)) {
    return normalizeEmployeeName(fromProfile);
  }

  const fromUser = user?.name?.trim();
  if (looksLikeHebrewDisplayName(fromUser)) {
    return normalizeEmployeeName(fromUser);
  }

  return null;
}

module.exports = {
  getExpectedEmployeeNameForUser,
  looksLikeHebrewDisplayName,
};
