// The app's own lint rules (eslint-rules/): accessibility of what is tapped and the hook's size.
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app = require('../../eslint-rules');

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

describe('eslint-rules', () => {
  describe('touchable-role: a touchable says what it is', () => {
    tester.run('touchable-role', app.rules['touchable-role'], {
      valid: [
        '<TouchableOpacity accessibilityRole="button"><Text>Ок</Text></TouchableOpacity>',
        '<Pressable role="link" />',
        '<TouchableOpacity {...props} />',
        '<View><Text>не тапается</Text></View>',
      ],
      invalid: [{ code: '<TouchableOpacity onPress={go}><Text>Ок</Text></TouchableOpacity>', errors: 1 }],
    });
  });

  describe('icon-touchable-label and hit-slop: only for a touchable of only an icon', () => {
    const icon = '<TouchableOpacity accessibilityRole="button" onPress={go}><CloseIcon /></TouchableOpacity>';
    tester.run('icon-touchable-label', app.rules['icon-touchable-label'], {
      valid: [
        '<TouchableOpacity accessibilityLabel="Закрыть"><CloseIcon /></TouchableOpacity>',
        '<TouchableOpacity><Text>Закрыть</Text></TouchableOpacity>',
        '<TouchableOpacity><Icon />{title}</TouchableOpacity>',
        '<TouchableOpacity><CategoryRow /></TouchableOpacity>',
      ],
      invalid: [
        { code: icon, errors: 1 },
        { code: '<Pressable><View><Svg><Path /></Svg></View></Pressable>', errors: 1 },
      ],
    });
    tester.run('icon-touchable-hit-slop', app.rules['icon-touchable-hit-slop'], {
      valid: [
        '<TouchableOpacity hitSlop={8}><CloseIcon /></TouchableOpacity>',
        '<TouchableOpacity><Text>Ок</Text></TouchableOpacity>',
      ],
      invalid: [{ code: icon, errors: 1 }],
    });
    tester.run('text-button', app.rules['text-button'], {
      valid: [
        '<TouchableOpacity><Icon /><Text>Мерчанты</Text></TouchableOpacity>',
        '<TouchableOpacity><View><Text>a</Text><Text>b</Text></View></TouchableOpacity>',
        '<TouchableOpacity><CloseIcon /></TouchableOpacity>',
      ],
      invalid: [
        { code: '<TouchableOpacity onPress={f}><Text style={s.link}>Отмена</Text></TouchableOpacity>', errors: 1 },
        { code: '<Pressable>\n  <Text>{label}</Text>\n</Pressable>', errors: 1 },
      ],
    });
  });

  describe('max-hook-lines: a hook (use*) is up to max lines of code, blank and comments not counted', () => {
    const body = (n: number) => Array.from({ length: n }, (_, i) => `  const a${i} = ${i};`).join('\n');
    const opts = [{ max: 3 }];
    tester.run('max-hook-lines', app.rules['max-hook-lines'], {
      valid: [
        { code: `function useA() {\n${body(1)}\n\n  // note\n}`, options: opts },
        { code: `function load() {\n${body(5)}\n}`, options: opts },
      ],
      invalid: [
        {
          code: `function useA() {\n${body(2)}\n}`,
          options: opts,
          errors: [{ message: 'Hook useA has too many lines (4). Maximum allowed is 3.' }],
        },
        { code: `const useB = () => {\n${body(2)}\n};`, options: opts, errors: 1 },
      ],
    });
  });

  describe('theme-tokens: the look from shared/theme, no literals', () => {
    tester.run('theme-tokens', app.rules['theme-tokens'], {
      valid: [
        'const s = { fontSize: font.body, padding: space[12], borderRadius: radius.md, color: colors.text };',
        'const s = { marginHorizontal: -16, marginTop: 0, width: 40, flex: 1 };',
        'const s = { fontWeight: weight.semibold, opacity: 0.5 };',
        '<Switch thumbColor={colors.white} />',
        "const label = 'Сумма #1';",
      ],
      invalid: [
        { code: 'const s = { fontSize: 13 };', errors: 1 },
        { code: 'const s = { paddingHorizontal: 12, gap: 8, borderTopLeftRadius: 4 };', errors: 3 },
        { code: "const s = { fontWeight: '600' };", errors: 1 },
        { code: "const s = { color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.35)' };", errors: 2 },
        { code: '<Switch thumbColor="#FFFFFF" />', errors: 1 },
        { code: "<Stop stopColor={'#000'} />", errors: 1 },
      ],
    });
  });
});
