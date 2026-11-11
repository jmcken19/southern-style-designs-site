// PORTFOLIO – a filterable photo gallery the owner manages in the editor (add, replace, remove, reorder,
// title + room type per photo). Stored in content/site.json → portfolio: [{ id, src, category, title, alt }].
// Room types come from client.config.json → portfolioCategories: [{ key, label }].
// Photo files: <src>-800.jpg, -1400.jpg, -2000.jpg (same sizes as the slideshow; new uploads go to /assets/img/hero/).

export const MAX_PORTFOLIO = 60;
const SRC_RE = /^\/assets\/img\/(work-\d{1,2}|hero\/s-[a-z0-9]{6,32})$/;
const ID_RE = /^s-[a-z0-9]{3,32}$/;

export const portfolioCategories = (config) => (Array.isArray(config?.portfolioCategories) ? config.portfolioCategories : []);

/** Problems with content/site.json → portfolio (empty list = fine). */
export function validatePortfolio(site, config) {
  const p = [];
  const list = site?.portfolio;
  if (list === undefined) return p;
  if (!Array.isArray(list)) return ['portfolio must be a list'];
  if (list.length > MAX_PORTFOLIO) p.push(`portfolio can have at most ${MAX_PORTFOLIO} photos`);
  const cats = new Set(portfolioCategories(config).map((c) => c.key));
  const ids = new Set();
  list.forEach((w, i) => {
    if (!ID_RE.test(w?.id || '')) p.push(`portfolio[${i}].id must look like s-xxxxxx`);
    if (ids.has(w?.id)) p.push(`portfolio[${i}].id is duplicated`);
    ids.add(w?.id);
    if (!SRC_RE.test(w?.src || '')) p.push(`portfolio[${i}].src must be /assets/img/work-N or /assets/img/hero/<id>`);
    if (!cats.has(w?.category)) p.push(`portfolio[${i}].category must be one of: ${[...cats].join(', ')}`);
    for (const f of ['title', 'alt']) if (typeof w?.[f] !== 'string' || w[f].length > 200) p.push(`portfolio[${i}].${f} must be text (max 200)`);
  });
  return p;
}
