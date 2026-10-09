// The architecture rules of ARCHITECTURE.md §1: the file sizes, the hooks, and the layers' imports (only down, not
// into a neighbour slice, from outside a slice only through its index.ts). Until the move of src/ui is done, all are
// warnings; src/ui itself has no layer rules (it is the old place).
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
const restrict = (patterns, message, oldUi = []) => ({
  'no-restricted-imports': ['warn', { patterns: [{ group: patterns, message }, ...(oldUi.length ? [{ group: oldUi, message: OLD_UI_MESSAGE }] : [])] }],
});

module.exports = tseslint.config(
  { ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**', 'coverage/**', '**/*.js'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // the core (db, parsers, notifications, …): no React layers at all; shared/lib is fine
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...LAYERS.map((l) => `src/${l}/**`), 'src/ui/**', 'src/App.tsx'],
    rules: restrict([...layer('app', 'screens', 'features', 'entities', 'shared/ui', 'shared/theme'), '**/ui/**', '**/ui', '!**/shared/ui/**', '!**/shared/ui'],
      'The core imports no UI: move the helper to src/shared/lib or into the core.'),
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
