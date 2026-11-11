#!/usr/bin/env node
// Design skills that come from other people's repos – each pinned to the exact commit that was reviewed.
//
//   npm run skills:design                  → install the BIG one that isn't committed (TasteSkill, ~40 MB)
//   npm run skills:design -- --with-3d     → also img2threejs (photo → 3D model; rarely right for client sites)
//   npm run skills:design -- --check       → no network: say what's installed, missing or not at its pin
//   npm run skills:design -- --refresh     → maintainers only: rebuild the COMMITTED copies from their pins
//                                            (after reviewing a new version and changing its pin below)
//
// Committed (small, so every clone – PC, cloud, phone session – has them with no download):
//   frontend-design, ui-ux-pro-max, web-design-guidelines, vercel-react-best-practices, design-styles, playwright-cli
// Fetched (too big to commit): taste-skill, img2threejs
// Every copy gets a "house rules" note at the top and a .source.json saying where it came from. See docs/SKILLS.md.
//
// Reviewed Nov 10, 2026 (read in full, searched for hidden instructions, network calls and scripts):
//   taste-skill        MIT        Leonxlnx/taste-skill              scripts start a local headless Chrome, fetch free
//                                                                   photos/icons; its end-of-session hook is REMOVED
//   design-styles      MIT        bergside/awesome-design-skills    markdown only; brand look-alike styles left out
//   img2threejs        Apache-2.0 img2threejs/img2threejs           local Python image tools only
//   frontend-design    Apache-2.0 anthropics/skills                 markdown only (Anthropic's official skill)
//   ui-ux-pro-max      MIT        nextlevelbuilder/ui-ux-pro-max-skill  Python stdlib search over local CSVs, no network
//   web-design-guidelines MIT     vercel-labs/agent-skills + vercel-labs/web-interface-guidelines
//                                                                   upstream fetches its rules from `main` on every run;
//                                                                   we store the rules at a pin instead
//   vercel-react-best-practices MIT vercel-labs/agent-skills        markdown only; only applies to React sites
//   playwright-cli     Apache-2.0 @playwright/cli (devDependency, exact version)  Microsoft; skill copied from the package
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BRAND_LOOKALIKES = ['claude', 'codex', 'cursor', 'roku', 'sega', 'pacman', 'tetris', 'lingo', 'stitch', 'impeccable'];

const RULE_WORDS = `**Client wording stays word for word.** Never write, rewrite, shorten or "improve" a client's words, reviews or
>    facts, and never invent copy, stats, awards or testimonials. Where a design needs words the client hasn't given,
>    leave a clearly marked gap and ask. All visible wording goes through the template's \`t()\` helper.`;
const RULE_BRAND = `**The client's brand and photos win.** A faithful rebuild keeps the client's own look; their logo colours beat
>    any palette this skill suggests. Stand-in photos only with the client's OK.`;
const RULE_TEMPLATE = `**Template rules still apply:** \`ui-quality\`, \`visual-check\`, WCAG AA, phone-first, the text-coverage test,
>    and no shaders, WebGL or scroll-jacking on small-business sites unless the client asks.`;
const note = (...extra) => `
> **James' Tech Help house rules for this skill (they win over everything below):**
> 1. ${RULE_WORDS}
> 2. ${RULE_BRAND}
> 3. ${RULE_TEMPLATE}
${extra.map((e, i) => `> ${i + 4}. ${e}`).join('\n')}
`;

// Each entry: where it comes from, where it goes, and what we change.
export const SKILLS = [
  { name: 'taste-skill', committed: false, advisory: true, repo: 'https://github.com/Leonxlnx/taste-skill.git', pin: 'f6b76575f949707b4e3c37cd86cb44b0b98643e8',
    from: 'skills/taste-skill', license: 'LICENSE', removeHooks: true,
    note: note('Its copy layer is OFF: skip "write all the copy first" and copy.md / copy-voice.md / copy-moves.md /\n>    copy-registers.md / copy-tells.md. Never add "plausible" hours, prices or a coined name, even marked data-assumed.\n>    When its gate\'s copy-lint fails on the client\'s own words, waive that finding in `.taste-skill/waivers.json` with the\n>    reason "client wording, kept word for word" – never change the words to pass. Use it for layout, photos, motion\n>    restraint and its visual checker.',
      '**Advisory only here.** Its checker wants every section to be exactly one or two full screens and the hero alone\n>    on the first screen – right for product launch pages, wrong for most small-business pages (a short "check the\n>    weather" strip is fine). Read its FAILs as suggestions; never pad sections or restructure a client\'s site to pass.',
      'Its automatic end-of-session check was removed on install. Run `node .claude/skills/taste-skill/scripts/gate.mjs`\n>    yourself when you want it.') },
  { name: 'frontend-design', committed: true, repo: 'https://github.com/anthropics/skills.git',
    pin: '2c5958ecac7cee2b583967a2c4981d0f4a75c579', from: 'skills/frontend-design', license: 'skills/frontend-design/LICENSE.txt',
    note: note('Its "come up with copy and placeholder content" advice is OFF for client sites (rule 1). Use its two-pass\n>    plan → review-against-the-brief process and its list of generic tells; the brief is `docs/DESIGN-BRIEF.md`.') },
  { name: 'ui-ux-pro-max', committed: true, repo: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
    pin: '6ae86f61f520d6ca229d2f40e070410638c908c5', from: '.claude/skills/ui-ux-pro-max', license: 'LICENSE', drop: ['scripts/tests'],
    replace: [[/"\$\{CLAUDE_PLUGIN_ROOT\}\/\.claude\/skills\/ui-ux-pro-max\/scripts\//g, '".claude/skills/ui-ux-pro-max/scripts/']],
    note: note('Run its search from the repo root: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`\n>    (Windows: `py -3` if `python` isn\'t found). Our sites are plain HTML/CSS – use `--stack html-tailwind` only for\n>    its HTML advice, never to add Tailwind.',
      'Use it for **category research** (which page pattern, UX rules, font pairings to consider). Treat its palette as a\n>    suggestion – it ignores the client\'s real colours. Its GSAP presets are off for small-business sites.') },
  { name: 'web-design-guidelines', committed: true, repo: 'https://github.com/vercel-labs/agent-skills.git',
    pin: '1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62', from: 'skills/web-design-guidelines', license: 'README.md#MIT',
    extra: { repo: 'https://github.com/vercel-labs/web-interface-guidelines.git', pin: '434b7f91364665f2f733b310ec54809bf8f37937',
      files: [['command.md', 'guidelines.md'], ['LICENSE', 'LICENSE']] },
    replace: [
      [/Fetch the latest guidelines from the source URL below/, 'Read the guidelines in `guidelines.md` next to this file (pinned copy – do NOT fetch them from the web)'],
      [/## Guidelines Source[\s\S]*?(?=## Usage)/, '## Guidelines Source\n\n`guidelines.md` in this folder: a pinned, reviewed copy of vercel-labs/web-interface-guidelines (see `.source.json`).\n\n'],
      [/1\. Fetch guidelines from the source URL above/, '1. Read `guidelines.md`'],
      [/3\. Apply all rules from the fetched guidelines/, '3. Apply all rules from `guidelines.md`']],
    note: note('Our sites are plain HTML, not React: read `onKeyDown`/`<Link>`/`focus-visible:ring-*` as their plain\n>    HTML/CSS equivalents. Report findings as `file:line`; fix them in `src/` and `public/assets/css/`, never in `dist/`.') },
  { name: 'vercel-react-best-practices', committed: true, repo: 'https://github.com/vercel-labs/agent-skills.git',
    pin: '1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62', from: 'skills/react-best-practices', license: 'README.md#MIT',
    note: note('**Only for a site built with React or Next.js.** The template and every client site so far are plain static\n>    HTML – there this skill does not apply; don\'t add React to use it.') },
  { name: 'img2threejs', committed: false, optional: '--with-3d', repo: 'https://github.com/img2threejs/img2threejs.git', pin: '0c0c49bc168e648dbaf9c8c080474de0b3a941b6',
    from: '.', license: 'LICENSE', drop: ['.git', '.github'],
    note: note('Rarely right for a client site (heavy, slow on phones). Only when the client asks for a 3D model, and always\n>    with a still-image fallback. Needs Python 3.') },
];
export const STYLES = { name: 'design-styles', committed: true, repo: 'https://github.com/bergside/awesome-design-skills.git',
  pin: 'f631a09b4fcc0166f2e2c1a8c81906ef680c57e8' };
export const PLAYWRIGHT = { name: 'playwright-cli', committed: true };

// ---- pure helpers (tested in tests/design-skills.test.mjs) ----
export function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) throw new Error('SKILL.md has no frontmatter');
  return { front: m[1], body: text.slice(m[0].length) };
}
export function removeHooks(front) {
  // drop a top-level "hooks:" key and everything indented under it
  return front.replace(/^hooks:[^\n]*\n(?:[ \t]+[^\n]*\n?|\n)*/m, '').replace(/\n+$/, '');
}
export function transformSkill(text, s) {
  let { front, body } = splitFrontmatter(text);
  if (s.removeHooks) front = removeHooks(front);
  if (/^hooks:/m.test(front)) throw new Error(`${s.name}: has a hook – not installing (review it first)`);
  for (const [from, to] of s.replace || []) {
    if (!from.test(body)) throw new Error(`${s.name}: expected text not found for ${from} – upstream changed, review it`);
    from.lastIndex = 0; body = body.replace(from, to);
  }
  return `---\n${front}\n---\n${s.note || ''}\n${body}`;
}
export function styleIndex(rows, pin) {
  return `---
name: design-styles
description: A library of ${rows.length} concrete visual styles (editorial, premium, friendly, bold, minimal, retro, brutalism…) with type scale, palette, spacing and component rules. Use when picking or building a design direction for a client site (design-from-scratch step 5) so a direction is specific, not "make it nice".
---
${note('Pick 1–3 styles that fit the brief, read their `DESIGN.md`, and **adapt** them – never paste a style unchanged.\n>    Styles that imitate a real company or game were left out on purpose; don\'t recreate them.')}
# Design styles (from Awesome Design, MIT – pinned ${pin.slice(0, 7)})

| Style | File | What it is |
|---|---|---|
${rows.join('\n')}
`;
}

// ---- install ----
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(root, '.claude', 'skills');
const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'pipe' });
function checkout(repo, pin) {
  const tmp = mkdtempSync(join(tmpdir(), 'skill-'));
  git(['init', '-q'], tmp); git(['remote', 'add', 'origin', repo], tmp);
  try { git(['fetch', '-q', '--depth', '1', 'origin', pin], tmp); }
  catch { git(['fetch', '-q', 'origin'], tmp); } // short sha: fetch everything, then check it out
  git(['checkout', '-q', pin.length === 40 ? 'FETCH_HEAD' : pin], tmp);
  return tmp;
}
const writeSource = (dest, info) => writeFileSync(join(dest, '.source.json'), JSON.stringify({ ...info, installed: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
function licenseText(tmp, spec) {
  const [file, section] = spec.split('#');
  const t = readFileSync(join(tmp, file), 'utf8');
  return section ? `${section} License – see ${file} of the source repo (named in .source.json).\n\n${(t.match(/## License[\s\S]*/) || [t])[0]}` : t;
}

function installSkill(s) {
  console.log(`Fetching ${s.name} @ ${s.pin.slice(0, 7)} …`);
  const tmp = checkout(s.repo, s.pin);
  const tmp2 = s.extra ? checkout(s.extra.repo, s.extra.pin) : null;
  try {
    const dest = join(skillsDir, s.name);
    rmSync(dest, { recursive: true, force: true }); mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(tmp, s.from), dest, { recursive: true });
    for (const d of s.drop || []) rmSync(join(dest, d), { recursive: true, force: true });
    writeFileSync(join(dest, existsSync(join(dest, 'LICENSE')) ? 'LICENSE' : 'LICENSE.txt'), licenseText(tmp, s.license));
    if (tmp2) for (const [a, b] of s.extra.files) cpSync(join(tmp2, a), join(dest, b === 'LICENSE' ? 'guidelines-LICENSE' : b));
    const md = join(dest, 'SKILL.md');
    writeFileSync(md, transformSkill(readFileSync(md, 'utf8'), s));
    writeSource(dest, { repo: s.repo, pin: s.pin, ...(s.extra ? { extra: { repo: s.extra.repo, pin: s.extra.pin } } : {}) });
    console.log(`  → .claude/skills/${s.name}/ (house rules added${s.removeHooks ? ', hook removed' : ''})`);
  } finally { rmSync(tmp, { recursive: true, force: true }); if (tmp2) rmSync(tmp2, { recursive: true, force: true }); }
}

function installStyles() {
  console.log(`Fetching ${STYLES.name} @ ${STYLES.pin.slice(0, 7)} …`);
  const tmp = checkout(STYLES.repo, STYLES.pin);
  try {
    const dest = join(skillsDir, STYLES.name);
    rmSync(dest, { recursive: true, force: true }); mkdirSync(join(dest, 'styles'), { recursive: true });
    const index = JSON.parse(readFileSync(join(tmp, 'skills', 'index.json'), 'utf8'));
    const rows = [];
    for (const [slug, info] of Object.entries(index).sort()) {
      if (BRAND_LOOKALIKES.includes(slug) || !existsSync(join(tmp, 'skills', slug, 'DESIGN.md'))) continue;
      cpSync(join(tmp, 'skills', slug, 'DESIGN.md'), join(dest, 'styles', slug, 'DESIGN.md'));
      const desc = (readFileSync(join(tmp, 'skills', slug, 'SKILL.md'), 'utf8').match(/^description:\s*(.+)$/m) || [])[1] || '';
      rows.push(`| ${info.name || slug} | \`styles/${slug}/DESIGN.md\` | ${desc.replace(/\|/g, '/')} |`);
    }
    cpSync(join(tmp, 'LICENSE'), join(dest, 'LICENSE'));
    writeFileSync(join(dest, 'SKILL.md'), styleIndex(rows, STYLES.pin));
    writeSource(dest, { repo: STYLES.repo, pin: STYLES.pin, left_out: BRAND_LOOKALIKES });
    console.log(`  → ${rows.length} styles (brand look-alikes left out)`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function installPlaywright() {
  const pkg = JSON.parse(readFileSync(join(root, 'node_modules', '@playwright', 'cli', 'package.json'), 'utf8'));
  console.log(`Copying the playwright-cli skill from @playwright/cli ${pkg.version} …`);
  const tmp = mkdtempSync(join(tmpdir(), 'pw-'));
  try {
    execFileSync(process.execPath, [join(root, 'node_modules', '@playwright', 'cli', 'playwright-cli.js'), 'install', '--skills'], { cwd: tmp, stdio: 'pipe' });
    const dest = join(skillsDir, PLAYWRIGHT.name);
    rmSync(dest, { recursive: true, force: true });
    cpSync(join(tmp, '.claude', 'skills', 'playwright-cli'), dest, { recursive: true });
    cpSync(join(root, 'node_modules', '@playwright', 'cli', 'LICENSE'), join(dest, 'LICENSE'));
    const md = join(dest, 'SKILL.md');
    writeFileSync(md, transformSkill(readFileSync(md, 'utf8'), { name: PLAYWRIGHT.name, note: note(
      'In this repo the command is `npx playwright-cli …` (it\'s a devDependency, so `npm ci` installs it). In a cloud\n>    session running as root, `.playwright/cli.config.json` turns off Chrome\'s sandbox (`npm run skills:design` writes it).',
      'Use it for ad-hoc checks (click through a page, fill a form on the LOCAL preview). Never submit a live client form\n>    or log into a client account with it. `npm run shots` and `npm run test:visual` stay the official checks.') }));
    writeSource(dest, { package: '@playwright/cli', version: pkg.version });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function cloudPlaywrightConfig() {
  // Chrome refuses to start as root with its sandbox on (cloud sessions run as root). Never needed on Windows/Mac.
  if (process.platform !== 'linux' || process.getuid?.() !== 0) return;
  const f = join(root, '.playwright', 'cli.config.json');
  if (existsSync(f)) return;
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify({ browser: { launchOptions: { chromiumSandbox: false } } }, null, 2) + '\n');
  console.log('Cloud session (root): wrote .playwright/cli.config.json so playwright-cli can start Chrome.');
}

export function check() {
  const rows = []; let ok = true;
  const want = [...SKILLS.filter((s) => !s.optional), STYLES];
  for (const s of want) {
    const src = join(skillsDir, s.name, '.source.json');
    if (!existsSync(join(skillsDir, s.name, 'SKILL.md'))) {
      if (s.advisory) { rows.push(`  – ${s.name}: not downloaded (optional, advisory) – npm run skills:design`); continue; }
      rows.push(`  ✗ ${s.name}: missing${s.committed ? ' (should be committed – git checkout it)' : ' – run npm run skills:design'}`); ok = false; continue;
    }
    const info = existsSync(src) ? JSON.parse(readFileSync(src, 'utf8')) : {};
    if (info.pin !== s.pin) { rows.push(`  ✗ ${s.name}: at ${info.pin || '?'} but pinned ${s.pin.slice(0, 7)} – run npm run skills:design${s.committed ? ' -- --refresh' : ''}`); ok = false; continue; }
    rows.push(`  ✓ ${s.name} @ ${s.pin.slice(0, 7)}`);
  }
  const pw = join(skillsDir, PLAYWRIGHT.name, '.source.json');
  if (existsSync(pw)) {
    const v = JSON.parse(readFileSync(pw, 'utf8')).version;
    const dep = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies?.['@playwright/cli'];
    if (dep !== v) { rows.push(`  ✗ playwright-cli: skill from ${v}, package.json has ${dep} – run npm run skills:design -- --refresh`); ok = false; }
    else rows.push(`  ✓ playwright-cli @ ${v}`);
  } else { rows.push('  ✗ playwright-cli: missing'); ok = false; }
  for (const d of readdirSync(skillsDir)) if (existsSync(join(skillsDir, d, 'SKILL.md')) && /^hooks:/m.test(splitFrontmatter(readFileSync(join(skillsDir, d, 'SKILL.md'), 'utf8')).front)) { rows.push(`  ✗ ${d}: has a hook`); ok = false; }
  return { ok, rows };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const { ok, rows } = check();
    console.log(rows.join('\n')); process.exit(ok ? 0 : 1);
  }
  const refresh = args.includes('--refresh');
  for (const s of SKILLS) {
    if (s.optional && !args.includes(s.optional)) continue;
    if (s.committed && !refresh) continue;
    installSkill(s);
  }
  if (refresh) { installStyles(); installPlaywright(); }
  cloudPlaywrightConfig();
  const { ok, rows } = check();
  console.log('\n' + rows.join('\n'));
  if (!ok) process.exit(1);
  console.log('\nDone. Claude Code picks up new skills when a session starts.');
}
