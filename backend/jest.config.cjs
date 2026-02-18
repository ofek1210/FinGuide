module.exports = {
  testEnvironment: 'node',
  // בשלב ראשון מריצים רק unit tests; integration אפשר להוסיף מאוחר יותר
  testMatch: ['**/tests/unit/**/*.test.js'],
  verbose: true,
  setupFilesAfterEnv: [],
};

