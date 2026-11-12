// Guide check (2026-11-13): every button, tab or menu the guide names (tr('…') and <B t="…" /> in
// src/app/guide/content-modules.tsx) must still be a label of a screen of the portal and have its Indonesian text in
// src/lib/i18n-id.ts. Runs before every build (npm "prebuild", Vercel included): a screen renamed or removed without
// updating the guide stops the build with the labels to fix. Run by hand: npm run check:guide
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = join(root, 'src');
const guideFile = join(src, 'app', 'guide', 'content-modules.tsx');
const idFile = join(src, 'lib', 'i18n-id.ts');

const files = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(n) ? [p] : [];
});
const all = (re, text) => [...text.matchAll(re)].map((m) => m[1]);

const guide = readFileSync(guideFile, 'utf8');
const labels = new Set([...all(/tr\('([^']+)'\)/g, guide), ...all(/\bt="([^"]+)"/g, guide)]);

const screens = new Set();
for (const f of files(src)) {
  const rel = relative(src, f).split(sep).join('/');
  if (rel.startsWith('app/guide/') || rel === 'lib/i18n-id.ts') continue;
  const text = readFileSync(f, 'utf8');
  for (const l of [...all(/tr\(\s*'([^']+)'/g, text), ...all(/tr\(\s*"([^"]+)"/g, text)]) screens.add(l);
}
const indonesian = readFileSync(idFile, 'utf8');
const translated = (l) => indonesian.includes(`${JSON.stringify(l)}:`) || indonesian.includes(`'${l}':`);

const gone = [...labels].filter((l) => !screens.has(l)).sort();
const untranslated = [...labels].filter((l) => !translated(l)).sort();
if (gone.length || untranslated.length) {
  console.error('Guide check failed (src/app/guide/content-modules.tsx):');
  if (gone.length) console.error(`  not a label of any screen any more (renamed or removed?):\n    ${gone.join('\n    ')}`);
  if (untranslated.length) console.error(`  without Indonesian text in src/lib/i18n-id.ts:\n    ${untranslated.join('\n    ')}`);
  console.error('Update the guide with the screen (or add the translation), then build again.');
  process.exit(1);
}
console.log(`Guide check: ${labels.size} labels, each on a screen and translated.`);
