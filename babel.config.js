module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  // `@/…` is src/ (ARCHITECTURE.md): imports between the layers without `../../..`
  plugins: [['module-resolver', { root: ['./'], alias: { '^@/(.+)': './src/\\1' }, extensions: ['.ts', '.tsx', '.js', '.json'] }]],
};
