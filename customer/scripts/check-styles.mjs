#!/usr/bin/env node
// Style guard rails. Run: npm run lint:styles
//
// Counts rule violations in src/**/*.scss and compares them with scripts/style-baseline.json.
// The count may go down (run with --update to lock in the improvement) but never up.
//
//   colour literal   hex / rgb / named white outside _tokens.scss  -> use var(--pp-*)
//   !important       fight with the cascade                        -> fix the order/specificity
//   raw font size    px/rem font-size up to 40px                   -> use var(--fs-*)
//   raw spacing      padding/margin/gap with a px value            -> use var(--space-*)
//   duplicate class  same top-level class in 2+ component files    -> move to shared/ui or src/styles
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BASELINE = join(ROOT, 'scripts/style-baseline.json');
const EXEMPT = ['_tokens.scss', '_bootstrap-overrides.scss'];

const walk = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.scss') ? [p] : [];
});

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = walk(join(ROOT, 'src')).filter(f => !EXEMPT.some(e => f.endsWith(e)));
const found = { 'colour literal': [], '!important': [], 'raw font size': [], 'raw spacing': [], 'duplicate class': [] };
const classOwners = new Map();

for (const file of files) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, 'utf8');
  const allowImportant = raw.includes('lint:allow-important');
  const lines = strip(raw).split('\n');
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\((?!\s*0\s*,\s*0\s*,\s*0)|:\s*white\b/.test(line)) found['colour literal'].push(at);
    if (line.includes('!important') && !allowImportant) found['!important'].push(at);
    const fs = line.match(/font-size:\s*([0-9.]+)(px|rem)\b(?!\s*\))/);
    if (fs && parseFloat(fs[1]) * (fs[2] === 'rem' ? 16 : 1) <= 40) found['raw font size'].push(at);
    if (/(padding|margin|gap)[a-z-]*:[^;]*\b\d+px/.test(line) && !/calc\(/.test(line)) found['raw spacing'].push(at);
    const top = line.match(/^\.([a-z][\w-]*)\b[^{]*\{/);
    if (top && rel.startsWith('src/app/') ) {
      const owners = classOwners.get(top[1]) ?? new Set();
      owners.add(rel);
      classOwners.set(top[1], owners);
    }
  });
}
for (const [name, owners] of classOwners) {
  if (owners.size > 1) found['duplicate class'].push(`.${name} in ${owners.size} files`);
}

const counts = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length]));
const update = process.argv.includes('--update');
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;

if (!baseline || update) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
  console.log(`Baseline ${baseline ? 'updated' : 'created'}:`, counts);
  process.exit(0);
}

let failed = false;
for (const [rule, n] of Object.entries(counts)) {
  const base = baseline[rule] ?? 0;
  const mark = n > base ? 'FAIL' : n < base ? 'better' : 'ok';
  console.log(`${mark.padEnd(6)} ${rule.padEnd(16)} ${String(n).padStart(4)}  (baseline ${base})`);
  if (n > base) {
    failed = true;
    found[rule].slice(0, 8).forEach(w => console.log('         ', w));
  }
}
if (!failed && Object.entries(counts).some(([r, n]) => n < (baseline[r] ?? 0))) {
  console.log('\nImproved. Run `npm run lint:styles -- --update` to lock in the new baseline.');
}
process.exit(failed ? 1 : 0);
