// The design skills from other people's repos: our install changes work, and the committed copies are safe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SKILLS, STYLES, BRAND_LOOKALIKES, removeHooks, splitFrontmatter, transformSkill } from '../scripts/design-skills.mjs';

const dir = join(import.meta.dirname, '..', '.claude', 'skills');
const committed = [...SKILLS.filter((s) => s.committed).map((s) => s.name), STYLES.name, 'playwright-cli'];

const HOOKED = `---
name: x
description: y
hooks:
  Stop:
    - hooks:
        - type: command
          command: 'echo hi'
          timeout: 600
---

# Body
`;

test('removeHooks drops the whole hooks block and nothing else', () => {
  const { front } = splitFrontmatter(HOOKED);
  assert.equal(removeHooks(front), 'name: x\ndescription: y');
});

test('transformSkill: hook removed, house note right after the frontmatter, body kept', () => {
  const out = transformSkill(HOOKED, { name: 'x', removeHooks: true, note: '\n> house rules for this skill\n' });
  assert.ok(!/hooks:/.test(out));
  assert.match(out, /^---\nname: x\ndescription: y\n---\n\n> house rules for this skill\n/);
  assert.match(out, /# Body/);
});

test('transformSkill refuses a skill that still has a hook', () => {
  assert.throws(() => transformSkill(HOOKED, { name: 'x' }), /has a hook/);
});

test('transformSkill refuses when an expected upstream text is gone (upstream changed → review again)', () => {
  assert.throws(() => transformSkill('---\nname: x\n---\nbody', { name: 'x', replace: [[/not here/, 'y']] }), /upstream changed/);
});

test('every pin is a full commit hash (an exact version, not a branch)', () => {
  for (const s of [...SKILLS, STYLES]) assert.match(s.pin, /^[0-9a-f]{40}$/, s.name);
});

for (const name of committed) {
  test(`committed skill ${name}: present, house rules on top, source recorded, licence included`, () => {
    const md = join(dir, name, 'SKILL.md');
    assert.ok(existsSync(md), `${name} missing – run: npm run skills:design -- --refresh`);
    const { front, body } = splitFrontmatter(readFileSync(md, 'utf8'));
    assert.match(front, /^name: /m);
    assert.match(front, /^description: /m);
    assert.ok(body.trimStart().startsWith("> **James' Tech Help house rules"), `${name}: house rules must come first`);
    assert.ok(existsSync(join(dir, name, '.source.json')), `${name}: .source.json`);
    assert.ok(readdirSync(join(dir, name)).some((f) => /^LICENSE/.test(f)), `${name}: licence`);
  });
}

test('no project skill has a hook (a hook runs commands in every session)', () => {
  for (const d of readdirSync(dir)) {
    const md = join(dir, d, 'SKILL.md');
    if (existsSync(md)) assert.ok(!/^hooks:/m.test(splitFrontmatter(readFileSync(md, 'utf8')).front), d);
  }
});

test('web-design-guidelines reads its pinned local rules, never fetches them', () => {
  const md = readFileSync(join(dir, 'web-design-guidelines', 'SKILL.md'), 'utf8');
  assert.ok(!/raw\.githubusercontent|WebFetch|https?:\/\//.test(splitFrontmatter(md).body.replace(/^>.*$/gm, '')), 'no URL to fetch');
  assert.ok(readFileSync(join(dir, 'web-design-guidelines', 'guidelines.md'), 'utf8').length > 2000);
});

test('ui-ux-pro-max search path works from the repo root (no plugin variable)', () => {
  const md = readFileSync(join(dir, 'ui-ux-pro-max', 'SKILL.md'), 'utf8');
  assert.ok(!md.includes('CLAUDE_PLUGIN_ROOT'));
  assert.ok(existsSync(join(dir, 'ui-ux-pro-max', 'scripts', 'search.py')));
});

test('design-styles leaves out every brand look-alike', () => {
  const styles = readdirSync(join(dir, 'design-styles', 'styles'));
  assert.ok(styles.length >= 50);
  for (const b of BRAND_LOOKALIKES) assert.ok(!styles.includes(b), b);
});

test('playwright-cli skill matches the exact @playwright/cli version in package.json', () => {
  const dep = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).devDependencies['@playwright/cli'];
  assert.match(dep, /^\d+\.\d+\.\d+$/, 'exact version, no ^ or ~');
  assert.equal(JSON.parse(readFileSync(join(dir, 'playwright-cli', '.source.json'), 'utf8')).version, dep);
});
