// The lint warnings by rule, with where each one is: docs/refactor/lint-baseline.txt (REFACTOR_PLAN.md, stage 0).
// Usage: npx eslint src -f json | node scripts/lint-baseline.js [out]
const fs = require('fs');
const out = process.argv[2] || 'docs/refactor/lint-baseline.txt';
let input = '';
process.stdin.on('data', (c) => (input += c)).on('end', () => {
  const by = {};
  for (const f of JSON.parse(input)) {
    for (const m of f.messages) {
      (by[m.ruleId] ??= []).push(`  ${f.filePath.replace(`${process.cwd()}/`, '')}:${m.line}`);
    }
  }
  const rules = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
  const total = rules.reduce((n, [, v]) => n + v.length, 0);
  const text = [
    `# npm run lint — warnings at the start of the refactor (REFACTOR_PLAN.md, stage 0), ${total} in all.`,
    '# A rule becomes an error once its list is empty. Made by scripts/lint-baseline.js.',
    '',
    ...rules.map(([k, v]) => `${v.length}\t${k}`),
    ...rules.map(([k, v]) => `\n${k} (${v.length})\n${v.join('\n')}`),
    '',
  ].join('\n');
  fs.writeFileSync(out, text);
  console.log(`${total} warnings → ${out}`);
});
