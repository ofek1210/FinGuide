module.exports = {
  testEnvironment: 'node',
  collectCoverage: false,
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/integration/step5\\.liveAudit\\.test\\.js$',
  ],
  transform: {},
  testTimeout: 30000,
};
