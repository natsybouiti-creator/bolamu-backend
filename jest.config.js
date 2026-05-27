module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/secrets.js'
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
      branches: 60
    }
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.js']
};
