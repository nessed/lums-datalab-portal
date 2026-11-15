// Plain titles and summaries (site/editorial/titles.json; DESIGN.md 6.4, round 2).
// Editorial text drafted by people or agents, never generated at build, never data.
// The build fails when:
//   - the file is missing or not marked "provisional": true;
//   - a visible series has no entry, or an entry has no title or no summary;
//   - a title or summary holds a digit (check-build counts every digit on a page);
//   - two series share a title (compared without case);
//   - a title is longer than TITLE_MAX or a summary longer than SUMMARY_MAX characters;
//   - an entry is keyed to a series the release does not hold;
//   - an entry's status is not "draft" or "approved".
// It also checks what the build made of the file: every visible series page's <h1>
// holds its title (so the adapter read the file), and the page keeps the printed name
// reachable (in About), so the full label is never lost one layer down.
import fs from "node:fs";
import path from "node:path";

// "At most about forty characters" is the aim; the hard limit leaves room for the
// long tails that must name a measure, a sex, a province, an area and a definition.
const TITLE_MAX = 72;
const SUMMARY_MAX = 130;
const STATUSES = new Set(["draft", "approved"]);

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

export default function check({ siteDir, appDir, release, seriesList, series, slugify, problem }) {
  const where = "editorial/titles.json";
  const file = path.join(siteDir, "editorial", "titles.json");
  if (!fs.existsSync(file)) {
    problem("titles", where, "missing");
    return "missing";
  }
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  if (j.provisional !== true) problem("titles", where, 'not marked "provisional": true');
  const entries = j.series ?? {};
  const visible = seriesList.filter((s) => ["published", "candidate"].includes(release.dataset_status?.[s.dataset]?.state));

  for (const id of Object.keys(entries)) if (!series.has(id)) problem("titles", where, `entry for "${id}", which the release does not hold`);

  const byTitle = new Map();
  let over40 = 0;
  let drafts = 0;
  for (const [id, e] of Object.entries(entries)) {
    const who = `${where} ${id}`;
    const title = typeof e?.title === "string" ? e.title.trim() : "";
    const summary = typeof e?.summary === "string" ? e.summary.trim() : "";
    if (!title) problem("titles", who, "no title");
    if (!summary) problem("titles", who, "no summary");
    if (/\d/.test(title)) problem("titles", who, `title holds a digit: "${title}"`);
    if (/\d/.test(summary)) problem("titles", who, `summary holds a digit: "${summary}"`);
    if (title.length > TITLE_MAX) problem("titles", who, `title is ${title.length} characters, over ${TITLE_MAX}: "${title}"`);
    if (summary.length > SUMMARY_MAX) problem("titles", who, `summary is ${summary.length} characters, over ${SUMMARY_MAX}`);
    if (summary && !/[.]$/.test(summary)) problem("titles", who, "summary is not one sentence ending in a full stop");
    if (summary && /[.!?]\s+[A-Z]/.test(summary.slice(0, -1))) problem("titles", who, "summary holds more than one sentence");
    if (!STATUSES.has(e?.status)) problem("titles", who, `status "${e?.status}" is neither "draft" nor "approved"`);
    if (e?.status === "draft") drafts++;
    if (title.length > 40) over40++;
    const k = title.toLowerCase();
    if (k && byTitle.has(k)) problem("titles", who, `title "${title}" is also the title of ${byTitle.get(k)}`);
    byTitle.set(k, id);
  }
  for (const s of visible) if (!entries[s.series_id]) problem("titles", `${where} ${s.series_id}`, "visible series without a title");

  // What the build made of it: the series page's h1 is the title; the printed name is still on the page.
  let pages = 0;
  const dir = path.join(appDir, "series");
  if (fs.existsSync(dir)) {
    for (const s of visible) {
      const f = path.join(dir, `${slugify(s.series_id)}.html`);
      if (!fs.existsSync(f)) continue;
      const html = fs.readFileSync(f, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
      const want = entries[s.series_id]?.title;
      if (want && (!h1 || !decode(h1[1]).startsWith(want))) problem("titles", `/series/${slugify(s.series_id)}`, `h1 "${h1 ? decode(h1[1]).slice(0, 80) : ""}" is not the title "${want}"`);
      if (!decode(html).includes(s.name.replace(/\s+/g, " ").trim())) problem("titles", `/series/${slugify(s.series_id)}`, "the printed name is not on the page");
      pages++;
    }
  }
  return `${Object.keys(entries).length} entries (${drafts} draft), ${visible.filter((s) => entries[s.series_id]).length} of ${visible.length} visible series titled, ${byTitle.size} unique titles, ${over40} over forty characters; ${pages} series pages carry their title and printed name`;
}
