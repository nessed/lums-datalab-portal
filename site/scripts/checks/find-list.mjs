// Find data, /browse (design set 2026-11-23). Written independently of
// src/app/browse/page.tsx. check-build itself checks every value, count and
// period on the page; this checks what it cannot see:
// 1. The server list (#cat-list) holds every top-level series of the visible data
//    types (no parent, or a parent the release does not hold) exactly once, and
//    nothing else, sorted A to Z by the title it shows.
// 2. Each row links to its series page, and its "Latest" is the latest checked
//    figure of that series (latest period; then actual, revised, provisional,
//    budget estimate), linked to its receipt, with the page reference of that
//    figure's main printing ("p. 7", or "p. 7 (PDF p. 9)" when the printed page
//    number differs) linked to that page of its document. A series with no
//    checked figure shows none.
import fs from "node:fs";
import path from "node:path";

const RANK = { actual: 4, re: 3, provisional: 2, be: 1, na: 0 };
const decode = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

export default function check({ appDir, release, seriesList, allObs, cells, isPub, slugify, problem }) {
  const page = "/browse";
  const file = path.join(appDir, "browse.html");
  if (!fs.existsSync(file)) {
    problem("find-list", page, "page not built");
    return "page not built";
  }
  const html = fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const start = html.indexOf('id="cat-list"');
  if (start < 0) {
    problem("find-list", page, "no server list (#cat-list)");
    return "no list";
  }
  const end = html.indexOf("</ul>", start);
  const list = html.slice(start, end);

  const visible = seriesList.filter((s) => ["published", "candidate"].includes(release.dataset_status?.[s.dataset]?.state));
  const ids = new Set(seriesList.map((s) => s.series_id));
  const roots = new Set(visible.filter((s) => !s.parent_id || !ids.has(s.parent_id)).map((s) => s.series_id));
  const latestOf = (sid) =>
    allObs
      .filter((o) => o.series_id === sid && isPub(o))
      .sort((a, b) => b.period.localeCompare(a.period) || (RANK[b.vintage] ?? 0) - (RANK[a.vintage] ?? 0))[0];

  const rows = [...list.matchAll(/<li class="cat-row fd-row"[^>]*data-series="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)];
  const seen = new Set();
  const titles = [];
  for (const [, rawId, inner] of rows) {
    const sid = decode(rawId);
    if (seen.has(sid)) problem("find-list", page, `${sid} is listed twice`);
    seen.add(sid);
    if (!roots.has(sid)) problem("find-list", page, `${sid} is listed but is not a top-level series of a visible data type`);
    const link = /<a [^>]*href="\/series\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(inner);
    if (!link || decodeURIComponent(link[1]) !== slugify(sid)) problem("find-list", page, `the row of ${sid} does not link to its series page`);
    titles.push({ sid, t: link ? decode(link[2]) : "" });
    const o = latestOf(sid);
    const latestAt = inner.indexOf('class="fd-latest"');
    const latest = latestAt >= 0 ? inner.slice(latestAt) : "";
    const shown = /data-latest="([^"]*)"/.exec(inner)?.[1];
    if (!o) {
      if (shown || /data-v=""/.test(latest)) problem("find-list", page, `${sid} has no checked figure but shows one`);
      continue;
    }
    if (decode(shown ?? "") !== o.obs_id) problem("find-list", page, `the latest of ${sid} is ${shown ?? "missing"}, the release's latest checked figure is ${o.obs_id}`);
    const vHref = /<a [^>]*href="(\/o\/[^"]+)"[^>]*data-v=""|<a [^>]*data-v=""[^>]*href="(\/o\/[^"]+)"/.exec(latest);
    const href = vHref ? (vHref[1] ?? vHref[2]) : null;
    if (href !== `/o/${slugify(o.obs_id)}`) problem("find-list", page, `the latest of ${sid} links to ${href ?? "nothing"}, not to the receipt of ${o.obs_id}`);
    const c = o.primary_cell_id ? cells.get(o.primary_cell_id) : null;
    if (c) {
      const want = c.page_label && c.page_label !== String(c.page) ? `p. ${c.page_label} (PDF p. ${c.page})` : `p. ${c.page}`;
      const pref = /<a [^>]*class="fd-pref"[^>]*>([\s\S]*?)<\/a>|<a [^>]*href="([^"]*)"[^>]*class="fd-pref"[^>]*>([\s\S]*?)<\/a>/.exec(latest);
      const prefTag = /<a [^>]*class="fd-pref"[^>]*>/.exec(latest)?.[0] ?? /<a [^>]*href="[^"]*"[^>]*class="fd-pref"[^>]*>/.exec(latest)?.[0] ?? "";
      const text = pref ? decode(pref[1] ?? pref[3] ?? "") : null;
      if (text !== want) problem("find-list", page, `the page reference of ${o.obs_id} reads "${text ?? "nothing"}", its main printing is on ${want}`);
      const ph = /href="([^"]*)"/.exec(prefTag)?.[1]?.replace(/&amp;/g, "&");
      if (ph !== `/sources/${slugify(c.source_id)}?page=${c.page}#viewer`) problem("find-list", page, `the page reference of ${o.obs_id} links to ${ph ?? "nothing"}, not to page ${c.page} of ${c.source_id}`);
    }
  }
  for (const sid of roots) if (!seen.has(sid)) problem("find-list", page, `top-level series ${sid} is missing from the list`);
  for (let i = 1; i < titles.length; i++) {
    const a = titles[i - 1];
    const b = titles[i];
    if (a.t.localeCompare(b.t) > 0) problem("find-list", page, `not A to Z: "${a.t}" before "${b.t}"`);
  }
  return `${rows.length} rows of ${roots.size} top-level series checked`;
}
