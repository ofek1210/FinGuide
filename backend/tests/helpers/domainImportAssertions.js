

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { buildHarBituachExcel } = require('../fixtures/buildHarBituachExcel');

const PENSION_FIXTURE = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');

async function uploadPensionFixture(app, token, filename = 'har-kesef-report.xlsx') {
  const buffer = fs.readFileSync(PENSION_FIXTURE);
  return request(app)
    .post('/api/pension/upload-file')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, filename);
}

async function uploadInsuranceFixture(app, token, filename = 'har-bituach.xlsx', rows) {
  const buffer = buildHarBituachExcel(rows);
  return request(app)
    .post('/api/insurance/upload-excel')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, filename);
}

function expectFindingsIncludeKinds(findingsRes, expectedKinds, titleRegex) {
  expect(findingsRes.statusCode).toBe(200);
  const findings = findingsRes.body.data || [];
  const kinds = findings.map(f => f.meta?.findingKind).filter(Boolean);
  const hasKind = expectedKinds.some(k => kinds.includes(k));
  const hasTitle = titleRegex ? findings.some(f => titleRegex.test(f.title)) : false;
  expect(hasKind || hasTitle).toBe(true);
  return findings;
}

module.exports = {
  uploadPensionFixture,
  uploadInsuranceFixture,
  expectFindingsIncludeKinds,
};
