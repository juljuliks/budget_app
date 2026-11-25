// The architecture rules of ARCHITECTURE.md §1: the file sizes, the hooks, and the layers' imports (only down, not
// into a neighbour slice, from outside a slice only through its index.ts). All errors: CI stops the release on one.
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const app = require('./eslint-rules');

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
  'no-restricted-imports': [
    'error',
    {
      patterns: [{ group: patterns, message }, ...(oldUi.length ? [{ group: oldUi, message: OLD_UI_MESSAGE }] : [])],
      paths,
    },
  ],
});
/** the core is no UI: no React; the platform's API only where it is the point (native/, notifications/) */
const NO_REACT = {
  name: 'react',
  message: 'The core has no React: a hook goes to src/shared (e.g. shared/settings) or a slice.',
};
const NO_RN = {
  name: 'react-native',
  message: "The platform's API in the core: only in src/native or src/notifications.",
};
const CORE_UI = [
  ...LAYERS.flatMap((l) => [`@/${l}`, `@/${l}/**`]).filter((g) => !g.startsWith('@/shared')),
  '@/shared/ui',
  '@/shared/ui/**',
  '@/shared/theme',
  '@/shared/theme/**',
  '@/shared/settings',
  '@/shared/settings/**',
  '**/app/**',
  '**/screens/**',
  '**/features/**',
  '**/entities/**',
  '**/shared/ui/**',
  '**/shared/theme/**',
  '**/shared/settings/**',
];
const CORE_MESSAGE = 'The core imports no UI: move the helper to src/shared/lib or into the core.';

/**
 * Over the size limits since Prettier (REFACTOR_PLAN.md, stage 0): the same code took more lines. Warnings until the
 * file is split in stage 5 — then it leaves this list; a file is never added to it.
 */
const OVERSIZE = [
  'src/db/categories.ts',
  'src/db/merchants.ts',
  'src/db/mergeCategories.ts',
  'src/db/migrations/steps-43-on.ts',
  'src/db/migrations/steps-59-on.ts',
  'src/db/plans/close.ts',
  'src/db/plans/history.ts',
  'src/db/plans/items.ts',
  'src/db/plans/stats.ts',
  'src/db/report.ts',
  'src/db/yearReport.ts',
  'src/entities/category/model/useCategoryChoose.ts',
  'src/entities/plan/ui/PlanAmountModal.tsx',
  'src/features/app-lock/model/usePinFlow.ts',
  'src/features/category-delete/model/useSortOut.ts',
  'src/features/category-merge/MergeCategoriesSheet.tsx',
  'src/features/merchant-card/model/useMerchantActions.ts',
  'src/features/operations-filters/model/useTransactionFilters.ts',
  'src/features/recurring-payments/ui/PaymentSheet.tsx',
  'src/features/recurring-payments/ui/RecurringPaymentsSheet.tsx',
  'src/screens/operations/OperationsScreen.tsx',
  'src/screens/stats/StatsHome.tsx',
  'src/screens/stats/month/StatsView.tsx',
  'src/screens/stats/month/parts/usePlanSheets.tsx',
  'src/screens/stats/period/model/periodView.ts',
  'src/screens/stats/period/parts/CategoryInfo.tsx',
  'src/screens/stats/plan/model/planView.ts',
  'src/screens/stats/plan/model/usePlanActions.ts',
  'src/screens/stats/trends/parts/FundTrend.tsx',
  'src/shared/ui/PressMenu.tsx',
  'src/shared/ui/icons.tsx',
];

/** a rule set as warnings: turned into errors rule by rule while the code is cleaned up (REFACTOR_PLAN.md, stage 5) */
const asWarnings = (rules = {}) =>
  Object.fromEntries(
    Object.entries(rules).map(([k, v]) => [
      k,
      (Array.isArray(v) ? v[0] : v) === 'off' || v === 0 ? v : Array.isArray(v) ? ['warn', ...v.slice(1)] : 'warn',
    ]),
  );
/** strict TypeScript (REFACTOR_PLAN.md A5): typescript-eslint recommended-type-checked */
const TYPE_CHECKED = tseslint.configs.recommendedTypeChecked.map((c) => ({
  ...c,
  files: ['src/**/*.{ts,tsx}'],
  rules: asWarnings(c.rules),
}));

module.exports = tseslint.config(
  { ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**', 'coverage/**', '**/*.js'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
    plugins: { 'react-hooks': reactHooks, app },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'app/max-hook-lines': ['error', { max: 100 }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // accessibility (REFACTOR_PLAN.md C5): warnings until stage 7
      'app/touchable-role': 'warn',
      'app/icon-touchable-label': 'warn',
      'app/icon-touchable-hit-slop': 'warn',
    },
  },
  ...TYPE_CHECKED,
  // the look from the theme (REFACTOR_PLAN.md B2): the scales and colors live in shared/theme; the palettes of
  // categories and banks are data
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/theme/**', 'src/domain/colors.ts', 'src/domain/banks.ts'],
    rules: { 'app/theme-tokens': 'error' },
  },
  {
    files: OVERSIZE,
    rules: {
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'app/max-hook-lines': ['warn', { max: 100 }],
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
    rules: restrict(
      [...layer('app', 'screens', 'features', 'entities')],
      'shared knows nothing of the layers above it.',
      OLD_UI('../../'),
    ),
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: restrict(
      [...layer('app', 'screens', 'features'), '@/entities/**'],
      'An entity imports only shared and the core; inside its slice — relative paths. Something two entities need goes down to shared.',
      IN_SLICE,
    ),
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: restrict(
      [...layer('app', 'screens'), '@/features/**', ...deep('entities')],
      'A feature imports entities (through their index.ts), shared and the core — not another feature: the screen puts them together.',
      IN_SLICE,
    ),
  },
  {
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: restrict(
      [...layer('app'), '@/screens/**', ...deep('features', 'entities')],
      'A screen imports features and entities through their index.ts, not another screen.',
      IN_SLICE,
    ),
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: restrict(
      deep('screens', 'features', 'entities'),
      'From outside a slice — only through its index.ts.',
      OLD_UI('../'),
    ),
  },
);
