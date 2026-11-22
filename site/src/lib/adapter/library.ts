// The Library (data hub plan, section 7): every source document and every
// dataset in plain words, as the contract's Library shape. Built only from
// contract records (sources, series, observations, cells, the release's
// dataset states), the editorial names (site/editorial/library.json) and the
// list of verified files the build can serve (written by
// scripts/prebuild/library.mjs). It never reads a number that is not a count
// or a period, and it never lists a file whose fingerprint does not match.
import fs from "node:fs";
import path from "node:path";
import type { Db } from "../data";
import type { Library, LibraryDataset, LibraryDocument, LibraryFile } from "./contract";

export type LibraryNames = {
  kinds: Record<string, { name: string; line: string; order: number }>;
  publishers: Record<string, string>;
  datasets: Record<string, { name: string; line: string }>;
  rejected: string;
  provisional?: boolean;
};

/** One row of public/data/<release>/sources/index.json. */
export type ServedFile = { source_id: string; file: string; bytes: number; sha256: string; via: LibraryFile["via"] };

export function readServedFiles(indexFile: string): ServedFile[] {
  if (!fs.existsSync(indexFile)) return [];
  const j = JSON.parse(fs.readFileSync(indexFile, "utf8")) as { files?: ServedFile[] };
  return j.files ?? [];
}

/** Datasets that have a combined download, by file name, under /data/<release>/datasets/. */
export function datasetFiles(dir: string, key: string, base: string): LibraryDataset["files"] {
  const f = (ext: string) => (fs.existsSync(path.join(dir, `${key}.${ext}`)) ? `${base}/datasets/${key}.${ext}` : null);
  return { csv: f("csv"), xlsx: f("xlsx"), zip: f("zip") };
}

export function buildLibrary(
  d: Db,
  names: LibraryNames,
  served: ServedFile[],
  opts: { filesBase: string; datasetFiles: (key: string) => LibraryDataset["files"]; visible: (dataset: string) => boolean },
): Library {
  const servedBy = new Map(served.map((f) => [f.source_id, f]));
  // Which series each document printed a figure for (main printing or another printing).
  const seriesOf = new Map<string, Set<string>>();
  for (const o of d.observations) {
    for (const id of [o.primary_cell_id, ...o.supporting_cell_ids]) {
      const c = id ? d.cellById.get(id) : undefined;
      if (!c) continue;
      const set = seriesOf.get(c.source_id) ?? new Set<string>();
      set.add(o.series_id);
      seriesOf.set(c.source_id, set);
    }
  }
  const pagesOf = new Map<string, Set<number>>();
  for (const c of d.cells) {
    const set = pagesOf.get(c.source_id) ?? new Set<number>();
    set.add(c.page);
    pagesOf.set(c.source_id, set);
  }

  const documents: LibraryDocument[] = d.sources.map((s) => {
    const f = servedBy.get(s.source_id);
    const rejected = s.verification_status === "failed";
    const sids = [...(seriesOf.get(s.source_id) ?? [])].filter((id) => d.seriesById.has(id));
    const datasets = [...new Set(sids.map((id) => d.seriesById.get(id)!.dataset))];
    const used = (s as { pages_used?: number[] }).pages_used ?? [];
    const pages = [...new Set([...used, ...(pagesOf.get(s.source_id) ?? [])])].sort((a, b) => a - b);
    return {
      id: s.source_id,
      kind: s.doc_type,
      kindName: names.kinds[s.doc_type]?.name ?? s.doc_type,
      printedTitle: s.title,
      period: s.period,
      publisher: names.publishers[s.publisher] ?? s.publisher,
      publisherFull: s.publisher,
      pages: (s as { page_count?: number | null }).page_count ?? null,
      bytes: (s as { size_bytes?: number | null }).size_bytes ?? null,
      format: (s as { format?: string }).format ?? "pdf",
      officialUrl: s.file_url,
      officialPage: s.landing_url,
      archiveUrl: s.wayback_url,
      sha256: (s as { sha256?: string | null }).sha256 ?? null,
      // A rejected file is never served or shown in the viewer.
      file: f && !rejected && f.sha256 === (s as { sha256?: string }).sha256 ? { href: `${opts.filesBase}/${f.file}`, bytes: f.bytes, sha256: f.sha256, via: f.via } : null,
      state: rejected ? "rejected" : sids.length || pages.length ? "read" : "document-only",
      rejectedReason: rejected ? names.rejected : null,
      pagesRead: rejected ? [] : pages,
      seriesIds: sids,
      datasets,
    };
  });
  const order = (k: string) => names.kinds[k]?.order ?? 99;
  // Grouped by kind, newest first.
  documents.sort((a, b) => order(a.kind) - order(b.kind) || b.period.localeCompare(a.period) || a.id.localeCompare(b.id));

  const keys = Object.keys(d.release.dataset_status ?? {});
  const datasets: LibraryDataset[] = keys.map((key) => {
    const ser = d.series.filter((s) => s.dataset === key);
    const periods = ser.flatMap((s) => (d.obsBySeries.get(s.series_id) ?? []).filter((o) => o.published && o.value !== null).map((o) => o.period)).sort();
    const docIds = documents.filter((x) => x.datasets.includes(key)).map((x) => x.id);
    return {
      key,
      name: names.datasets[key]?.name ?? d.release.dataset_status[key]?.name ?? key,
      line: names.datasets[key]?.line ?? "",
      firstPeriod: periods[0] ?? null,
      lastPeriod: periods[periods.length - 1] ?? null,
      seriesCount: ser.length,
      visible: opts.visible(key),
      files: opts.datasetFiles(key),
      documentIds: docIds,
      previewSeries: ser
        .filter((s) => !s.parent_id || !d.seriesById.has(s.parent_id))
        .filter((s) => (d.obsBySeries.get(s.series_id) ?? []).some((o) => o.published && o.value !== null))
        .slice(0, 6)
        .map((s) => s.series_id),
    };
  });
  return { documents, datasets, namesStatus: names.provisional === false ? "approved" : "draft" };
}
