/** Single Jest config covering unit (test/unit) and e2e (test/e2e) suites. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  // Live integration tests (test/integration/) hit real APIs and are excluded from the
  // default run. Use `npm run test:live` to run them explicitly.
  testPathIgnorePatterns: ['/node_modules/', '/test/integration/'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
