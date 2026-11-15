// Evidence step of the prebuild (DESIGN.md 5.4, 7, 14.1-14.2). Writes, under
// public/data/<version>/evidence/:
//   crops/<cell id>-<n>.webp  pre-cut crops of the page render around each
//                             printed cell a receipt or sheet shows: small
//                             files with set dimensions, at most 40 KB per
//                             cell. Cut only around an exact (solid) box. The
//                             page image itself is never edited and no box is
//                             drawn into a crop: the site draws the box over it.
//   sheet/<slug>.json         the one-tap sheet of each shown value: crop,
//                             document, page, row and column as printed, the
//                             verdict sentence and the versions strip.
// Geometry, verdict and versions come from src/components/evidence/model.ts,
// the same code the receipt page renders with, so they cannot disagree.
// scripts/checks/evidence-sheet.mjs checks every number in the sheets.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Budget for the crop of one cell, all its windows together (DESIGN.md 14.1). */
export const CROP_BUDGET = 40 * 1024;
/** Encoder settings, part of every cached crop's name: change it to cut every crop again. */
const GEN = "q60";

export default async function evidence({ siteDir, version, src, dest, slugify }) {
  const t0 = Date.now();
  const imp = (p) => import(pathToFileURL(path.join(siteDir, p)).href);
  const { loadDatalab } = await imp("src/lib/adapter/datalab.ts");
  const model = await imp("src/components/evidence/model.ts");
  const sharp = (await import("sharp")).default;
  const db = loadDatalab(src);
  const dataBase = `/data/${version}`;
  const outDir = path.join(dest, "evidence");
  const cropDir = path.join(outDir, "crops");
  const sheetDir = path.join(outDir, "sheet");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(cropDir, { recursive: true });
  fs.mkdirSync(sheetDir, { recursive: true });

  const visible = (o) => ["published", "candidate"].includes(db.release.dataset_status?.[db.seriesById.get(o.series_id)?.dataset]?.state ?? "");
  const pageFile = (sourceId, page) => path.join(src, "pages", sourceId, `p${String(page).padStart(3, "0")}.png`);
  const dimCache = new Map();
  const dims = (sourceId, page) => {
    const k = `${sourceId}/${page}`;
    if (dimCache.has(k)) return dimCache.get(k);
    const f = pageFile(sourceId, page);
    let d = null;
    if (fs.existsSync(f)) {
      const fd = fs.openSync(f, "r");
      const buf = Buffer.alloc(24);
      fs.readSync(fd, buf, 0, 24, 0);
      fs.closeSync(fd);
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) d = { width, height };
    }
    dimCache.set(k, d);
    return d;
  };

  // Which cells need a crop: the figure's own printing where its page may be
  // shown, the other printings of a shown value, and every printing of a
  // disputed figure.
  const plans = new Map();
  const want = (cell) => {
    if (!cell || plans.has(cell.cell_id)) return;
    const d = dims(cell.source_id, cell.page);
    if (!d) return;
    const ev = model.printedEvidence(cell, true);
    if (ev.boxState !== "exact") return;
    const plan = model.cropPlan(cell, db.cellsBySource.get(cell.source_id) ?? [], d);
    if (plan) plans.set(cell.cell_id, { cell, plan });
  };
  for (const o of db.observations) {
    if (!visible(o)) continue;
    const cell = o.primary_cell_id ? db.cellById.get(o.primary_cell_id) : undefined;
    if (model.pageAllowed(o, cell)) want(cell);
    if (o.reader.showsValue && o.published) for (const id of o.supporting_cell_ids) want(db.cellById.get(id));
    if (o.reader.key === "disputed") {
      const raw = Array.isArray(o.disputed_readings) ? o.disputed_readings : [];
      const ids = raw.map((r) => (typeof r === "string" ? r : r?.cell_id)).filter(Boolean);
      for (const id of ids.length ? ids : [o.primary_cell_id, ...o.supporting_cell_ids]) want(db.cellById.get(id));
    }
  }

  // Cut them, one decoded page at a time.
  const byPage = new Map();
  for (const p of plans.values()) {
    const k = `${p.cell.source_id}/${p.cell.page}`;
    if (!byPage.has(k)) byPage.set(k, []);
    byPage.get(k).push(p);
  }
  let files = 0;
  let bytes = 0;
  let maxCell = 0;
  let cached = 0;
  const over = [];
  // Cutting takes minutes, so finished crops are kept in .next/cache (never
  // published) under a name that holds their geometry, and linked into place
  // on the next run. A crop whose geometry or encoder settings change gets a
  // new name and is cut again.
  const cacheDir = path.join(siteDir, ".next", "cache", "evidence-crops", version);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheName = (w) => `${w.file.replace(/\.webp$/, "")}.${GEN}.${w.px.join("_")}.webp`;
  const place = (from, to) => {
    try {
      fs.linkSync(from, to);
    } catch {
      fs.copyFileSync(from, to);
    }
  };
  const todo = new Map();
  for (const [k, list] of byPage) {
    const rest = [];
    for (const p of list) {
      const hits = p.plan.windows.map((w) => path.join(cacheDir, cacheName(w)));
      if (hits.every((h) => fs.existsSync(h))) {
        let total = 0;
        p.plan.windows.forEach((w, i) => {
          place(hits[i], path.join(cropDir, w.file));
          total += fs.statSync(hits[i]).size;
          files++;
        });
        if (total > CROP_BUDGET) over.push(p.plan.cellId);
        maxCell = Math.max(maxCell, total);
        bytes += total;
        cached++;
      } else rest.push(p);
    }
    if (rest.length) todo.set(k, rest);
  }
  for (const list of todo.values()) {
    const { cell } = list[0];
    const { data, info } = await sharp(pageFile(cell.source_id, cell.page)).raw().toBuffer({ resolveWithObject: true });
    const cut = (px, quality) =>
      sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .extract({ left: px[0], top: px[1], width: px[2], height: px[3] })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toBuffer();
    for (let i = 0; i < list.length; i += 8) {
      await Promise.all(
        list.slice(i, i + 8).map(async ({ plan }) => {
          let quality = 60;
          let bufs = await Promise.all(plan.windows.map((w) => cut(w.px, quality)));
          while (bufs.reduce((a, b) => a + b.length, 0) > CROP_BUDGET && quality > 30) {
            quality -= 14;
            bufs = await Promise.all(plan.windows.map((w) => cut(w.px, quality)));
          }
          const total = bufs.reduce((a, b) => a + b.length, 0);
          if (total > CROP_BUDGET) over.push(plan.cellId);
          maxCell = Math.max(maxCell, total);
          bytes += total;
          plan.windows.forEach((w, k) => {
            const c = path.join(cacheDir, cacheName(w));
            fs.writeFileSync(c, bufs[k]);
            place(c, path.join(cropDir, w.file));
            files++;
          });
        }),
      );
    }
  }
  if (over.length) console.warn(`prebuild evidence: ${over.length} crops over ${CROP_BUDGET} bytes, e.g. ${over.slice(0, 3).join(", ")}`);

  // One sheet per shown value (the only figures a data-sheet link can open).
  let sheets = 0;
  for (const o of db.observations) {
    if (!visible(o) || !o.reader.showsValue || !o.published) continue;
    const cell = o.primary_cell_id ? db.cellById.get(o.primary_cell_id) : undefined;
    const sheet = model.sheetData(db, o, {
      dataBase,
      crop: cell ? (plans.get(cell.cell_id)?.plan ?? null) : null,
      hasImage: !!(cell && dims(cell.source_id, cell.page)),
    });
    fs.writeFileSync(path.join(sheetDir, `${slugify(o.obs_id)}.json`), JSON.stringify(sheet));
    sheets++;
  }
  return `${plans.size} crops (${cached} from cache; ${files} files, ${(bytes / 1048576).toFixed(1)} MB, largest ${(maxCell / 1024).toFixed(1)} KB), ${sheets} sheets, ${((Date.now() - t0) / 1000).toFixed(0)} s`;
}
