// The architecture rules of ARCHITECTURE.md §1: the file sizes, the hooks, and the layers' imports (only down, not
// into a neighbour slice, from outside a slice only through its index.ts). All errors: CI stops the release on one.
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

const LAYERS = ['app', 'screens', 'features', 'entities', 'shared'];
/** imports of these layers, through the alias or by a relative path */
const layer = (...names) => names.flatMap((n) => [`@/${n}`, `@/${n}/**`, `**/${n}/**`]);
/** a slice's insides from outside of it: only its index.ts */
const deep = (...names) => names.map((n) => `@/${n}/*/**`);
/**
 * The old src/ui: the layers do not import it (a file moved out takes its imports along). By the path up to src/ from
 * the layer's depth — a slice's own ui/ segment (./ui/X, ../ui/X from model/) is not it.
 */
const OLD_UI = (up) => ['@/ui', '@/ui/**', `${up}ui`, `${up}ui/**`];
const IN_SLICE = [...new Set([...OLD_UI('../../'), ...OLD_UI('../../../')])];

const OLD_UI_MESSAGE = 'The old src/ui: move what this needs to its layer first (ARCHITECTURE.md §2).';
const restrict = (patterns, message, oldUi = [], paths = []) => ({
  'no-restricted-imports': ['error', {
    patterns: [{ group: patterns, message }, ...(oldUi.length ? [{ group: oldUi, message: OLD_UI_MESSAGE }] : [])],
    paths,
  }],
});
/** the core is no UI: no React; the platform's API only where it is the point (native/, notifications/) */
const NO_REACT = { name: 'react', message: 'The core has no React: a hook goes to src/shared (e.g. shared/settings) or a slice.' };
const NO_RN = { name: 'react-native', message: 'The platform\'s API in the core: only in src/native or src/notifications.' };
const CORE_UI = [...LAYERS.flatMap((l) => [`@/${l}`, `@/${l}/**`]).filter((g) => !g.startsWith('@/shared')),
  '@/shared/ui', '@/shared/ui/**', '@/shared/theme', '@/shared/theme/**', '@/shared/settings', '@/shared/settings/**',
  '**/app/**', '**/screens/**', '**/features/**', '**/entities/**', '**/shared/ui/**', '**/shared/theme/**', '**/shared/settings/**'];
const CORE_MESSAGE = 'The core imports no UI: move the helper to src/shared/lib or into the core.';

module.exports = tseslint.config(
  { ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**', 'coverage/**', '**/*.js'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  // the core (db, ingest, categorize, parsers, …): no React layers, no React; shared/lib and shared/navigation are fine
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...LAYERS.map((l) => `src/${l}/**`), 'src/native/**', 'src/notifications/**'],
    rules: restrict(CORE_UI, CORE_MESSAGE, [], [NO_REACT, NO_RN]),
  },
  {
    files: ['src/native/**/*.{ts,tsx}', 'src/notifications/**/*.{ts,tsx}'],
    rules: restrict(CORE_UI, CORE_MESSAGE, [], [NO_REACT]),
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: restrict([...layer('app', 'screens', 'features', 'entities')],
      'shared knows nothing of the layers above it.', OLD_UI('../../')),
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: restrict([...layer('app', 'screens', 'features'), '@/entities/**'],
      'An entity imports only shared and the core; inside its slice — relative paths. Something two entities need goes down to shared.', IN_SLICE),
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: restrict([...layer('app', 'screens'), '@/features/**', ...deep('entities')],
      'A feature imports entities (through their index.ts), shared and the core — not another feature: the screen puts them together.', IN_SLICE),
  },
  {
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: restrict([...layer('app'), '@/screens/**', ...deep('features', 'entities')],
      'A screen imports features and entities through their index.ts, not another screen.', IN_SLICE),
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: restrict(deep('screens', 'features', 'entities'),
      'From outside a slice — only through its index.ts.', OLD_UI('../')),
  },
);
