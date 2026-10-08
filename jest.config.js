// Two kinds of tests: the logic (ts-jest in Node: the database, parsers, plans) and the screens (the app rendered with
// React Native Testing Library on an in-memory database: what the user sees and does, without an emulator).
module.exports = {
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
    },
    {
      displayName: 'screens',
      preset: 'react-native',
      testMatch: ['<rootDir>/__tests__/screens/**/*.test.tsx'],
      setupFiles: ['<rootDir>/__tests__/screens/setup.ts'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/screens/afterEnv.ts'],
      transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|react-native-.*|@notifee)/)'],
      // the Node SQLite driver instead of the device's one (the preset would pick driver.native.ts)
      moduleNameMapper: { '^(\\.{1,2}/)+(src/db/)?driver$': '<rootDir>/src/db/driver.ts' },
    },
  ],
};
