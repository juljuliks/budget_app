// Two kinds of tests: the logic (ts-jest in Node: the database, parsers, plans) and the screens (the app rendered with
// React Native Testing Library on an in-memory database: what the user sees and does, without an emulator).
module.exports = {
  // npm run coverage: the thresholds are the coverage at the start of the refactor, rounded down (REFACTOR_PLAN.md E2)
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageReporters: ['text-summary', 'json-summary'],
  coverageThreshold: { global: { statements: 89, branches: 76, functions: 87, lines: 91 } },
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/logic/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'screens',
      preset: 'react-native',
      testMatch: ['<rootDir>/tests/screens/**/*.test.tsx'],
      setupFiles: ['<rootDir>/tests/screens/setup.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/screens/afterEnv.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|react-native-.*|@notifee)/)',
      ],
      // the Node SQLite driver instead of the device's one (the preset would pick driver.native.ts)
      moduleNameMapper: {
        '^(\\.{1,2}/)+((src/)?db/)?driver$': '<rootDir>/src/db/driver.ts',
        '^@/db/driver$': '<rootDir>/src/db/driver.ts',
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],
};
