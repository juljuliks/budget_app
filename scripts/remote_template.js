// A bank's message template for Firebase Remote Config (parameter "message_templates", src/parsers/remoteTemplates.ts):
// built from a real message and its marked words, as «Не распознано» → marking does in the app, checked the same way
// the phone checks it. Prints the entry to add to the parameter's "templates".
//
// Usage:
//   node scripts/remote_template.js --key tbc-push-payment-2026-12 --source push --bank tbc --kind payment \
//     --sms "$(cat message.txt)" amount=45.00 currency=GEL merchant=FABRIKA date=09.10.2026 date=10:00 balance="2 843.17"
//   a "hide such" one (promo, codes): --hide instead of --kind, no marks
// Roles: amount, currency, merchant, date, balance (a word may be given only once; several words of one merchant /
// date — the role repeated). The parameter in the console: { "schema": 1, "templates": [ …entries… ] }.
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist-tools');
// the app's own building and checking, compiled as is
execFileSync('npx', ['tsc', 'src/parsers/remoteTemplates.ts', '--outDir', out, '--rootDir', '.', '--module', 'commonjs',
  '--target', 'es2020', '--skipLibCheck', '--esModuleInterop'], { cwd: root, stdio: 'inherit' });
const { buildTemplate, wordsOf } = require(path.join(out, 'src/parsers/template.js'));
const { parseRemoteTemplates } = require(path.join(out, 'src/parsers/remoteTemplates.js'));

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const hide = args.includes('--hide') && !!args.splice(args.indexOf('--hide'), 1);
const key = flag('key');
const source = flag('source') ?? 'sms';
const bank = flag('bank') ?? 'tbc';
const kind = flag('kind') ?? null;
const sms = flag('sms');
if (!key || !sms || (!hide && !kind)) {
  console.error('Usage: node scripts/remote_template.js --key <name> --source sms|push --bank tbc (--kind <kind> | --hide) --sms "<text>" role=word …');
  process.exit(2);
}

const words = wordsOf(sms).map((w) => w.text);
const marks = {};
for (const a of hide ? [] : args) {
  const [role, ...rest] = a.split('=');
  const word = rest.join('=');
  const i = words.indexOf(word);
  if (i < 0) { console.error(`"${word}" is not a word of the message; its words: ${JSON.stringify(words)}`); process.exit(1); }
  marks[i] = role;
}
const spec = buildTemplate(sms, marks);
const entry = { key, source, bank, action: hide ? 'hide' : 'operation', kind: hide ? null : kind, pattern: spec.pattern, slots: spec.slots, example: sms };
const { templates, dropped } = parseRemoteTemplates(JSON.stringify({ schema: 1, templates: [entry] }));
fs.rmSync(out, { recursive: true, force: true });
if (!templates.length) { console.error('the phone would drop it:', dropped.join('; ')); process.exit(1); }
console.log(JSON.stringify(entry, null, 2));
