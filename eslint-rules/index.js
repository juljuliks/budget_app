// The app's own lint rules (eslint.config.js, plugin "app"): accessibility of what is tapped (REFACTOR_PLAN.md C5 —
// eslint-plugin-react-native-a11y is stuck on eslint 8) and the hook's size (ARCHITECTURE.md §1: a hook — up to 100).
const TOUCHABLE = /^(Pressable|Touchable(Opacity|Highlight|WithoutFeedback|NativeFeedback))$/;
/** what an icon is drawn with: a touchable of only these has no text a screen reader could read */
const ICON = /(Icon|Svg|Image|Path|Circle|Rect|Line|^G|^View)$/;

const nameOf = (el) =>
  el.name.type === 'JSXIdentifier' ? el.name.name : el.name.type === 'JSXMemberExpression' ? el.name.property.name : '';
const attr = (el, name) =>
  el.attributes.some((a) => a.type === 'JSXSpreadAttribute' || (a.type === 'JSXAttribute' && a.name.name === name));

/** no text inside: only icon elements, no words and no {expressions} (they may be a text or a component with one) */
const iconOnly = (children) =>
  children.every((c) => {
    if (c.type === 'JSXText') return !c.value.trim();
    if (c.type === 'JSXExpressionContainer') return c.expression.type === 'JSXEmptyExpression';
    if (c.type === 'JSXFragment') return iconOnly(c.children);
    if (c.type === 'JSXElement') return ICON.test(nameOf(c.openingElement)) && iconOnly(c.children);
    return true;
  });

/** only one <Text> inside (whitespace aside): a button drawn by hand — Button, TextLink or Chip draws it */
const textOnly = (children) => {
  const els = children.filter((c) => !(c.type === 'JSXText' && !c.value.trim()));
  return els.length === 1 && els[0].type === 'JSXElement' && nameOf(els[0].openingElement) === 'Text';
};

const touchableRule = (description, check) => ({
  meta: { type: 'suggestion', docs: { description }, schema: [] },
  create: (context) => ({
    JSXElement(node) {
      const el = node.openingElement;
      if (!TOUCHABLE.test(nameOf(el))) return;
      const message = check(el, node);
      if (message) context.report({ node: el, message });
    },
  }),
});

/** lines that have code on them: blank and comment-only ones are not counted (like max-lines' skip options) */
function codeLines(sourceCode, node) {
  const lines = new Set();
  for (const t of sourceCode.getTokens(node)) {
    for (let l = t.loc.start.line; l <= t.loc.end.line; l++) lines.add(l);
  }
  return lines.size;
}

const HOOK = /^use[A-Z0-9]/;
const hookName = (node) => {
  if (node.type === 'FunctionDeclaration') return node.id?.name;
  const p = node.parent;
  return p?.type === 'VariableDeclarator' && p.id.type === 'Identifier' ? p.id.name : undefined;
};

/** style keys that take a token (shared/theme/tokens.ts): sizes and weights of text, spacing, radii */
const SIZE_KEY =
  /^(fontSize|(padding|margin)(Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|gap|rowGap|columnGap|border(Top|Bottom)?(Left|Right|Start|End)?Radius)$/;
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(.*\))$/i;
const keyName = (k) => (k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : '');

const themeTokens = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Text sizes, weights, spacing, radii and colors come from shared/theme (REFACTOR_PLAN.md B2)',
    },
    schema: [],
  },
  create(context) {
    const report = (node, what) =>
      context.report({
        node,
        message: `${what}: take it from shared/theme (tokens.ts: font, weight, space, radius; theme.ts: colors).`,
      });
    return {
      Property(node) {
        const key = keyName(node.key);
        const v = node.value;
        if (v.type !== 'Literal') return;
        if (SIZE_KEY.test(key) && typeof v.value === 'number' && v.value > 0) report(v, `${key}: ${v.value}`);
        if (key === 'fontWeight' && typeof v.value === 'string') report(v, `fontWeight: '${v.value}'`);
        if (typeof v.value === 'string' && COLOR.test(v.value)) report(v, `${key}: '${v.value}'`);
      },
      JSXAttribute(node) {
        const v = node.value;
        const s = v?.type === 'Literal' ? v.value : v?.expression?.type === 'Literal' ? v.expression.value : null;
        if (typeof s === 'string' && COLOR.test(s)) report(v, `${node.name.name}="${s}"`);
      },
    };
  },
};

module.exports = {
  rules: {
    'theme-tokens': themeTokens,
    'touchable-role': touchableRule('A touchable says what it is (accessibilityRole)', (el) =>
      attr(el, 'accessibilityRole') || attr(el, 'role')
        ? null
        : 'A touchable needs accessibilityRole ("button", "link", "checkbox", …): a screen reader says what it is.',
    ),
    'text-button': touchableRule('A text button is Button, TextLink or Chip (REFACTOR_PLAN.md B3)', (el, node) =>
      textOnly(node.children)
        ? 'A touchable of only a text is a button drawn by hand: use shared/ui Button, TextLink (a link «… ›») or Chip.'
        : null,
    ),
    'icon-touchable-label': touchableRule('A touchable of only an icon has a label', (el, node) =>
      !iconOnly(node.children) || attr(el, 'accessibilityLabel') || attr(el, 'aria-label')
        ? null
        : 'A touchable of only an icon needs accessibilityLabel: there is no text for a screen reader to read.',
    ),
    'icon-touchable-hit-slop': touchableRule('A touchable of only an icon is easy to hit', (el, node) =>
      !iconOnly(node.children) || attr(el, 'hitSlop')
        ? null
        : 'A touchable of only an icon needs hitSlop: the area to press is at least 44 pt.',
    ),
    'max-hook-lines': {
      meta: {
        type: 'suggestion',
        docs: { description: 'A hook (use*) is up to `max` lines of code' },
        schema: [{ type: 'object', properties: { max: { type: 'integer' } }, additionalProperties: false }],
      },
      create(context) {
        const max = context.options[0]?.max ?? 100;
        const check = (node) => {
          const name = hookName(node);
          if (!name || !HOOK.test(name)) return;
          const n = codeLines(context.sourceCode, node);
          if (n > max) {
            context.report({
              node: node.id ?? node.parent,
              message: `Hook ${name} has too many lines (${n}). Maximum allowed is ${max}.`,
            });
          }
        };
        return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
      },
    },
  },
};
