'use strict';

const GemelAdvisorReport = require('../../models/GemelAdvisorReport');

async function saveGemelAdvisorReport(userId, runId, report) {
  await GemelAdvisorReport.findOneAndUpdate(
    { runId },
    { user: userId, runId, report },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function getGemelAdvisorReport(userId, runId) {
  if (!runId) return null;
  const doc = await GemelAdvisorReport.findOne({ runId, user: userId }).lean();
  return doc?.report ?? null;
}

module.exports = { saveGemelAdvisorReport, getGemelAdvisorReport };
