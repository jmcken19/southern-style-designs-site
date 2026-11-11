#!/usr/bin/env node
// Turn a client's photo into website-ready files (no GPS/camera data, sensible sizes).
//   Slideshow photo:  npm run photo -- hero  path/to/photo.jpg  2      → public/assets/img/hero-2-{800,1400,2000}.jpg
//   Any other photo:  npm run photo -- page  path/to/photo.jpg  team   → public/assets/img/team-{800,1400}.jpg
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [kind, file, name] = process.argv.slice(2);
if (!['hero', 'page'].includes(kind) || !file || !name) {
  console.error('Usage: npm run photo -- hero <file> <number>   |   npm run photo -- page <file> <name>');
  process.exit(1);
}
const sizes = kind === 'hero' ? [800, 1400, 2000] : [800, 1400];
const base = kind === 'hero' ? `hero-${name}` : name;
for (const w of sizes) {
  const out = join(root, 'public/assets/img', `${base}-${w}.jpg`);
  // .rotate() applies the camera's orientation; sharp drops EXIF/GPS unless asked to keep it.
  await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
  console.log('wrote', out.replace(root + '/', ''));
}
if (kind === 'hero') console.log(`\nAdd to content/site.json → heroSlides: { "id": "s-hero${name}", "src": "/assets/img/${base}", "alt": "…", "focus": "50% 50%" }`);
else console.log(`\nUse "/assets/img/${base}-800.jpg" (small) and "/assets/img/${base}-1400.jpg" (large), e.g. as a photo spot's defaults.`);
