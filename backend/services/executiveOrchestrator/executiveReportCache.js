'use strict';

const ExecutiveReport = require('../../models/ExecutiveReport');

async function saveExecutiveReport(userId, runId, report) {
  await ExecutiveReport.findOneAndUpdate(
    { runId },
    { user: userId, runId, report },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function getExecutiveReport(userId, runId) {
  if (!runId) return null;
  const doc = await ExecutiveReport.findOne({ runId, user: userId }).lean();
  return doc?.report ?? null;
}

async function getLatestExecutiveReport(userId) {
  const doc = await ExecutiveReport.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .lean();
  if (!doc) return null;
  return { runId: doc.runId, report: doc.report, savedAt: doc.createdAt };
}

module.exports = {
  saveExecutiveReport,
  getExecutiveReport,
  getLatestExecutiveReport,
};
