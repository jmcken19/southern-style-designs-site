// "Photo spots": single photos on the website the owner can replace in the editor
// (a headshot, a page banner, a team photo…). Each client's spots are defined in
// client.config.json → photoSpots. The chosen photo for a spot is stored in content/site.json → photos.
// Uploaded photos live in public/assets/img/hero/<id>-<800|1400|2000>.jpg (same folder as slideshow photos).

const PATH_RE = /^\/assets\/img\/[a-z0-9/_.-]+\.(jpg|jpeg|png|webp)$/i;
const ID_RE = /^s-[a-z0-9]{3,32}$/;
const KEY_RE = /^[a-z][a-z0-9-]{1,30}$/;

/** The photo to show in a spot: { id?, small, large, alt }. `spots` = config.photoSpots. */
export function sitePhoto(site, spots, key) {
  const def = spots?.[key];
  if (!def) throw new Error(`Unknown photo spot "${key}" – add it to client.config.json → photoSpots`);
  const d = def.defaults;
  const p = site?.photos?.[key];
  return p && p.small && p.large ? { ...d, ...p } : { ...d };
}

/** Check client.config.json → photoSpots. */
export function validateSpotConfig(spots) {
  const problems = [];
  if (spots == null) return problems;
  if (typeof spots !== 'object' || Array.isArray(spots)) return ['photoSpots must be an object'];
  for (const [k, s] of Object.entries(spots)) {
    if (!KEY_RE.test(k)) problems.push(`photoSpots.${k}: key must be lowercase letters/numbers/dashes`);
    for (const f of ['label', 'where', 'page']) if (typeof s?.[f] !== 'string' || !s[f]) problems.push(`photoSpots.${k}.${f} is required`);
    if (s?.page && !s.page.startsWith('/')) problems.push(`photoSpots.${k}.page must be a site path like /about/`);
    for (const f of ['small', 'large']) if (!PATH_RE.test(String(s?.defaults?.[f] || ''))) problems.push(`photoSpots.${k}.defaults.${f} must be a path under /assets/img/`);
  }
  return problems;
}

/** Check content/site.json → photos against the configured spots. */
export function validatePhotos(site, spots) {
  const problems = [];
  const photos = site?.photos;
  if (photos == null) return problems;
  if (typeof photos !== 'object' || Array.isArray(photos)) return ['"photos" must be an object'];
  for (const [k, p] of Object.entries(photos)) {
    if (!spots?.[k]) { problems.push(`photos.${k}: not a photo spot in client.config.json`); continue; }
    if (!p || typeof p !== 'object') { problems.push(`photos.${k}: must be an object`); continue; }
    for (const f of ['small', 'large']) if (!PATH_RE.test(String(p[f] || ''))) problems.push(`photos.${k}.${f}: must be a path under /assets/img/`);
    if (p.id != null && !ID_RE.test(p.id)) problems.push(`photos.${k}.id: invalid`);
    if (p.alt != null && (typeof p.alt !== 'string' || p.alt.length > 200)) problems.push(`photos.${k}.alt: must be text up to 200 characters`);
  }
  return problems;
}
