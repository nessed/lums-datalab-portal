// What's new on /releases (design set 2026-11-23). Written independently of
// src/app/releases/page.tsx.
//
// The entries are recomputed here from the release:
//   added        one per visible data type (dataset_status state published or candidate);
//   editions     one per document that holds the main printing of at least one checked
//                figure of a visible data type;
//   held         one per visible data type with figures that failed their checks;
//   corrections  one per checked figure of a visible data type whose last_changed_release
//                differs from its first_published_release.
// 1. The page lists exactly those entries (data-wn-kind, data-wn-key), each dated
//    with the release's build date.
// 2. Every tab count and every count in the opening sentence (data-num="derived",
//    data-derived="whatsnew-tab", data-tab=all|added|editions|corrections) equals the
//    number of entries recomputed here (all = every entry); each is claimed here.
// 3. The corrections block (#corrections) is on the page; it shows the empty state
//    ("No corrections so far.") exactly when there is no correction, and the opening
//    sentence says that no published figure has been corrected exactly then.
import fs from "node:fs";
import path from "node:path";

export default function check({ appDir, release, seriesList, allObs, cells, sources, isPub, slugify, problem, derived }) {
  const page = "/releases";
  const file = path.join(appDir, "releases.html");
  const visibleDs = Object.keys(release.dataset_status ?? {}).filter((k) => ["published", "candidate"].includes(release.dataset_status[k]?.state));
  const dsOf = new Map(seriesList.map((s) => [s.series_id, s.dataset]));
  const visObs = allObs.filter((o) => visibleDs.includes(dsOf.get(o.series_id)));

  const want = { added: new Set(), editions: new Set(), held: new Set(), corrections: new Set() };
  for (const k of visibleDs) want.added.add(`added:${k}`);
  const srcIds = new Set(sources.map((s) => s.source_id));
  for (const o of visObs) {
    if (!isPub(o) || !o.primary_cell_id) continue;
    const src = cells.get(o.primary_cell_id)?.source_id;
    if (src && srcIds.has(src)) want.editions.add(`edition:${src}`);
  }
  for (const k of visibleDs) {
    const failed = visObs.filter((o) => dsOf.get(o.series_id) === k && !isPub(o) && o.status !== "disputed" && o.gap_kind === "failed_checks").length;
    if (failed > 0) want.held.add(`held:${k}`);
  }
  for (const o of visObs)
    if (isPub(o) && o.last_changed_release && o.first_published_release && o.last_changed_release !== o.first_published_release) want.corrections.add(`correction:${o.obs_id}`);
  const n = {
    added: want.added.size,
    editions: want.editions.size,
    corrections: want.corrections.size,
    all: want.added.size + want.editions.size + want.held.size + want.corrections.size,
  };

  // 2. derived counts (claimed even when the page is missing, so they are not reported twice)
  let claimed = 0;
  for (const d of derived ?? []) {
    if (d.attrs["data-derived"] !== "whatsnew-tab") continue;
    d.claimed = true;
    claimed++;
    if (d.page !== page) {
      problem("whatsnew", d.page, `a What's new count outside ${page}`);
      continue;
    }
    const tab = d.attrs["data-tab"];
    if (!(tab in n)) {
      problem("whatsnew", page, `count for unknown tab "${tab}"`);
      continue;
    }
    if (d.text !== String(n[tab])) problem("whatsnew", page, `the ${tab} count shows "${d.text}" but the release gives ${n[tab]}`);
  }

  if (!fs.existsSync(file)) {
    problem("whatsnew", page, "page not built");
    return "page not built";
  }
  const html = fs.readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!-- -->/g, "");

  // 1. entries
  const date = String(release.created_at ?? "").slice(0, 10);
  const got = { added: new Set(), editions: new Set(), held: new Set(), corrections: new Set() };
  for (const m of html.matchAll(/<li class="wn-entry" data-wn-kind="([^"]*)" data-wn-key="([^"]*)">([\s\S]*?)<\/li>/g)) {
    const [, kind, key, inner] = m;
    if (!(kind in got)) {
      problem("whatsnew", page, `entry ${key} has unknown kind "${kind}"`);
      continue;
    }
    if (got[kind].has(key)) problem("whatsnew", page, `entry ${key} is listed twice`);
    got[kind].add(key);
    if (!inner.includes(`data-num="date">${date}<`)) problem("whatsnew", page, `entry ${key} is not dated ${date}, the release's build date`);
    if (kind === "editions" && !inner.includes(`href="/sources/${slugify(key.slice("edition:".length))}"`)) problem("whatsnew", page, `entry ${key} does not link to its document`);
    if (kind === "corrections" && !inner.includes(`href="/o/${slugify(key.slice("correction:".length))}"`)) problem("whatsnew", page, `entry ${key} does not link to its figure`);
  }
  for (const kind of Object.keys(want)) {
    for (const k of want[kind]) if (!got[kind].has(k)) problem("whatsnew", page, `missing ${kind} entry ${k}`);
    for (const k of got[kind]) if (!want[kind].has(k)) problem("whatsnew", page, `${kind} entry ${k} is not in the release`);
  }

  // 3. corrections block and sentence
  if (!/\sid="corrections"/.test(html)) problem("whatsnew", page, 'no corrections block (id="corrections")');
  const empty = html.includes('data-wn-empty="corrections"');
  if (empty !== (n.corrections === 0)) problem("whatsnew", page, `the empty corrections state is ${empty ? "shown" : "missing"} with ${n.corrections} corrections in the release`);
  const none = html.includes("No published figure has been corrected.");
  if (none !== (n.corrections === 0)) problem("whatsnew", page, `the opening sentence ${none ? "says" : "does not say"} that nothing was corrected, with ${n.corrections} corrections`);

  return `${n.all} entries (${n.added} added, ${n.editions} editions, ${want.held.size} held back, ${n.corrections} corrections), ${claimed} counts claimed`;
}
