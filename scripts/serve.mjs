#!/usr/bin/env node
// npm run serve            → builds the testing preview into dist/ and serves it at http://localhost:8080/
// npm run serve -- 3000    → another port.  Ctrl+C to stop. For playwright-cli click-throughs and quick looks.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from './lib/static-server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8080;
execFileSync(process.execPath, [join(root, 'scripts/build.mjs'), '--preview'], { stdio: 'inherit' });
await serveDir(join(root, 'dist'), port);
console.log(`\nServing dist/ at http://localhost:${port}/  (Ctrl+C to stop)`);
