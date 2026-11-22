// The Library (data hub plan, section 7): /library, /library/datasets and every
// document page /sources/<id>. Written independently of src/lib/library-format.ts
// and src/lib/adapter/library.ts.
//
// 1. Derived figures (data-num="derived") of the Library, claimed and recomputed
//    from the release here:
//      lib-source-size    data-source=<source_id>: the release's size_bytes of that
//                         document, under the size rule below;
//      lib-download-size  data-file=<path under public/data/<release>/>: the size of
//                         that built download file on disk, under the same rule;
//      lib-source-series  data-source=<source_id>: how many series of a visible
//                         dataset have a figure printed in that document (main
//                         printing or another printing).
//    Size rule (binary units, as the plan and Windows use them): under 1,024 bytes
//    "N bytes"; under 1,048,576 bytes whole KB, halves up, at least 1; else MB to
//    one decimal, halves up. Integer arithmetic only.
//    Page counts, document counts and series counts per dataset use the existing
//    count keys (src:<id>:page_count, pages:source:<id>, sources:type:<kind>,
//    series:<dataset>), which check-build recomputes itself.
// 2. Served files: every row of public/data/<release>/sources/index.json names a
//    source of the release that did not fail verification, a file that exists, is
//    that many bytes long and whose SHA-256 is the release's fingerprint.
// 3. Every link on these pages to a served file names a row of index.json; a
//    document's viewer (data-viewer-src) opens its own served file only; a document
//    with no served file, or a rejected one, has no viewer and no download of it.
// 4. The Library index lists every document of the release exactly once.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function sizeText(n) {
  const b = BigInt(n);
  if (b < 1024n) return `${b} bytes`;
  if (b < 1048576n) {
    const k = (b * 2n + 1024n) / 2048n;
    return `${k < 1n ? 1n : k} KB`;
  }
  const t = (b * 20n + 1048576n) / 2097152n;
  return `${t / 10n}.${t % 10n} MB`;
}

const attrRe = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
const unq = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
/** Every element's attributes, in document order (server markup only). */
function elements(html) {
  const out = [];
  const h = html.replace(/<script[\s\S]*?<\/script>/g, "");
  for (const m of h.matchAll(/<([a-zA-Z][\w-]*)(\s[^>]*)?>/g)) {
    const attrs = {};
    for (const a of (m[2] ?? "").matchAll(attrRe)) attrs[a[1].toLowerCase()] = unq(a[2] ?? a[3] ?? "");
    out.push({ tag: m[1].toLowerCase(), attrs });
  }
  return out;
}

export default function check({ siteDir, appDir, cfg, release, series, allObs, cells, sources, sourceById, slugify, problem, derived }) {
  const v = cfg.version;
  const pubDir = path.join(siteDir, "public", "data", v);
  const base = (process.env.LIBRARY_FILES_BASE ?? "").replace(/\/+$/, "") || `/data/${v}/sources`;
  const visible = (ds) => ["published", "candidate"].includes(release.dataset_status?.[ds]?.state);

  // Series per document, recomputed from observations and cells.
  const seriesOf = new Map();
  for (const o of allObs) {
    const s = series.get(o.series_id);
    if (!s || !visible(s.dataset)) continue;
    for (const id of [o.primary_cell_id, ...(o.supporting_cell_ids ?? [])]) {
      const c = id ? cells.get(id) : null;
      if (!c) continue;
      if (!seriesOf.has(c.source_id)) seriesOf.set(c.source_id, new Set());
      seriesOf.get(c.source_id).add(o.series_id);
    }
  }

  /* 1. derived figures */
  let claimed = 0;
  for (const d of derived ?? []) {
    const f = d.attrs["data-derived"];
    if (!f || !f.startsWith("lib-")) continue;
    d.claimed = true;
    claimed++;
    let want;
    if (f === "lib-source-size") {
      const s = sourceById.get(d.attrs["data-source"] ?? "");
      if (!s || typeof s.size_bytes !== "number") {
        problem("library", d.page, `file size "${d.text}" names no document with a recorded size (${d.attrs["data-source"]})`);
        continue;
      }
      want = sizeText(s.size_bytes);
    } else if (f === "lib-download-size") {
      const rel = d.attrs["data-file"] ?? "";
      const p = path.join(pubDir, ...rel.split("/"));
      if (!rel || rel.includes("..") || !fs.existsSync(p)) {
        problem("library", d.page, `download size "${d.text}" names no built file (${rel})`);
        continue;
      }
      want = sizeText(fs.statSync(p).size);
    } else if (f === "lib-source-series") {
      const id = d.attrs["data-source"] ?? "";
      if (!sourceById.has(id)) {
        problem("library", d.page, `series count "${d.text}" names no document (${id})`);
        continue;
      }
      want = String(seriesOf.get(id)?.size ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else {
      problem("library", d.page, `unknown Library figure "${f}"`);
      continue;
    }
    if (d.text !== want) problem("library", d.page, `${f} shows "${d.text}" but the release gives "${want}"`);
  }

  /* 2. served files */
  const indexFile = path.join(pubDir, "sources", "index.json");
  const served = new Map();
  if (fs.existsSync(indexFile)) {
    for (const f of JSON.parse(fs.readFileSync(indexFile, "utf8")).files ?? []) {
      const s = sourceById.get(f.source_id);
      const p = path.join(pubDir, "sources", f.file ?? "");
      if (!s) problem("library-file", f.file, `served file names no source of the release (${f.source_id})`);
      else if (s.verification_status === "failed") problem("library-file", f.file, `served file of ${f.source_id}, whose verification failed`);
      else if (f.sha256 !== s.sha256) problem("library-file", f.file, `index fingerprint differs from the release's for ${f.source_id}`);
      else if (!f.file || f.file.includes("/") || f.file.includes("\\") || !fs.existsSync(p)) problem("library-file", f.file, "listed file is missing");
      else if (fs.statSync(p).size !== f.bytes || (typeof s.size_bytes === "number" && s.size_bytes !== f.bytes)) problem("library-file", f.file, "file size differs from the index or the release");
      else if (crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") !== s.sha256) problem("library-file", f.file, `bytes do not match the fingerprint of ${f.source_id}`);
      else served.set(f.source_id, `${base}/${f.file}`);
    }
  }
  const servedHrefs = new Set(served.values());

  /* 3 and 4. the pages */
  const pages = [
    ["/library", path.join(appDir, "library.html"), null],
    ["/library/datasets", path.join(appDir, "library", "datasets.html"), null],
    ...sources.map((s) => [`/sources/${slugify(s.source_id)}`, path.join(appDir, "sources", `${slugify(s.source_id)}.html`), s]),
  ];
  let scanned = 0;
  for (const [route, file, src] of pages) {
    if (!fs.existsSync(file)) {
      problem("library", route, "page not built");
      continue;
    }
    scanned++;
    const els = elements(fs.readFileSync(file, "utf8"));
    for (const e of els) {
      const href = e.attrs.href ?? "";
      const fileHref = href.split("#")[0].split("?")[0];
      if (fileHref.startsWith(`${base}/`) && !servedHrefs.has(fileHref)) problem("library", route, `link to ${fileHref}, which is not a verified served file`);
      if ("data-viewer-src" in e.attrs) {
        const want = src ? served.get(src.source_id) : null;
        if (!src) problem("library", route, "a document viewer outside a document page");
        else if (!want || e.attrs["data-viewer-src"] !== want) problem("library", route, `viewer opens ${e.attrs["data-viewer-src"]}, not this document's verified file`);
      }
    }
    if (src) {
      const own = served.get(src.source_id);
      if (own && src.format === "pdf" && !els.some((e) => "data-viewer-src" in e.attrs)) problem("library", route, "document has a verified PDF but no viewer");
      if (src.verification_status === "failed" && els.some((e) => (e.attrs.href ?? "").startsWith(`${base}/`) || "data-viewer-src" in e.attrs))
        problem("library", route, "rejected document offers a file or a viewer");
    }
    if (route === "/library") {
      const rows = els.filter((e) => "data-lib-row" in e.attrs).map((e) => e.attrs["data-lib-row"]);
      for (const s of sources) {
        const n = rows.filter((r) => r === s.source_id).length;
        if (n !== 1) problem("library", route, `document ${s.source_id} is listed ${n} times`);
      }
      for (const r of rows) if (!sourceById.has(r)) problem("library", route, `listed document ${r} is not in the release`);
    }
  }
  return `${claimed} Library figures recomputed, ${served.size} served files verified, ${scanned} pages scanned`;
}
