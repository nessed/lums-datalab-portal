// Server side of the series page (DESIGN.md 9.5): everything the page shows,
// read from the release through the adapter (db()), decided at build time.
// Derived figures come only from src/lib/series-derive.ts, which uses only
// figures whose reader status says usableInDerived.
import { db, obsHref, slugify, type Observation, type Series } from "@/lib/data";
import { bestModelFrom, chartModelFrom, type ChartModel } from "@/lib/chart-model";
import { changeView, indexView, revisionView, shareView, KIND_RANK, type DInput, type DMeta, type DPoint, type DView } from "@/lib/series-derive";
import { visualKey } from "@/lib/status";
import { KIND } from "@/lib/words";
import { latestPublished } from "@/lib/stats";

/** Kind of figure in words, from our release's code (DESIGN.md 6.2). */
export function kindLong(o: Pick<Observation, "vintage" | "kind">): string {
  if (o.vintage === "na") return o.kind === "as_printed" ? "" : KIND[o.kind]?.long ?? "";
  return KIND[o.kind]?.long ?? o.vintage;
}

/** Kind words per vintage code of a series, for derived-view messages and legends. */
export function kindWordsOf(series: Series): Record<string, string> {
  const out: Record<string, string> = { rev: "change from budget to revised" };
  for (const o of db().obsBySeries.get(series.series_id) ?? []) out[o.vintage] = kindLong(o) || "figure";
  return out;
}

export function dmeta(series: Series): DMeta {
  return { frequency: series.frequency, unit: series.unit, breaks: series.breaks, kindWords: kindWordsOf(series) };
}

/** A figure as the derivations see it: a value only where the adapter shows one, and whether it may feed a derived value. */
export function dinput(o: Observation): DInput {
  const usable = o.reader.usableInDerived && o.reader.showsValue && o.published && o.value !== null;
  return { id: o.obs_id, period: o.period, kind: o.vintage, value: usable ? o.value : null, usable, word: o.reader.word, reason: o.reader.reason, st: visualKey(o.reader) };
}

const SHARE_UNITS = ["PKR", "persons"];

export function parentForShare(series: Series): Series | null {
  const p = series.parent_id ? db().seriesById.get(series.parent_id) : undefined;
  if (!p || !SHARE_UNITS.includes(series.unit) || p.unit !== series.unit || p.scale_factor !== series.scale_factor) return null;
  return p;
}

export type UnitOption = { id: "printed" | "pct" | "chg" | "idx" | "share"; label: string; available: boolean; why?: string };

/** The Units menu (DESIGN.md 11): what is offered for this series, and why not when not. */
export function unitOptions(series: Series): UnitOption[] {
  const rate = series.unit === "percent";
  const round = series.frequency === "survey_round";
  const parent = parentForShare(series);
  return [
    { id: "printed", label: "As printed", available: true },
    {
      id: "pct",
      label: round ? "% change from the previous round" : "% change from a year earlier",
      available: !rate,
      why: rate ? "not for a rate: use Change" : undefined,
    },
    { id: "chg", label: round ? "Change from the previous round" : "Change from a year earlier", available: true },
    { id: "idx", label: "Index, chosen period = 100", available: !rate, why: rate ? "not for a rate" : undefined },
    {
      id: "share",
      label: "Share of the parent total",
      available: !!parent,
      why: parent ? undefined : series.parent_id ? "the parent is in another unit" : "this series has no parent total",
    },
  ];
}

/** Every derived view of a series, computed here at build time. */
export function derivedViews(series: Series): DView[] {
  const d = db();
  const recs = (d.obsBySeries.get(series.series_id) ?? []).map(dinput);
  const meta = dmeta(series);
  const opts = unitOptions(series);
  const on = (id: UnitOption["id"]) => opts.find((o) => o.id === id)?.available;
  const out: DView[] = [];
  if (on("pct")) out.push(changeView("pct", meta, recs));
  if (on("chg")) out.push(changeView("chg", meta, recs));
  if (on("idx")) {
    const bases = [...new Set(recs.filter((r) => r.usable).map((r) => r.period))].sort();
    for (const b of bases) out.push(indexView(meta, recs, b));
  }
  const parent = parentForShare(series);
  if (parent) out.push(shareView(meta, recs, (d.obsBySeries.get(parent.series_id) ?? []).map(dinput), parent.name));
  if (hasBudgetPair(series)) out.push(revisionView(meta, recs));
  return out;
}

/** A budget series that prints both a budget and a revised estimate. */
export function hasBudgetPair(series: Series): boolean {
  const v = new Set((db().obsBySeries.get(series.series_id) ?? []).map((o) => o.vintage));
  return v.has("be") && v.has("re");
}

/* ---------- the answer line (9.5 item 2) ---------- */

export type Answer = {
  latest: Observation | null;
  /** The newest figure of all, when it is not the latest checked one (it shows no value). */
  newer: Observation | null;
  change: { op: "pct" | "chg"; point: DPoint; against: Observation } | null;
  noChange: string | null;
};

export function answerOf(series: Series): Answer {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const latest = latestPublished(series.series_id) ?? null;
  const newest = [...all].sort((a, b) => b.period.localeCompare(a.period) || (KIND_RANK[b.vintage] ?? 0) - (KIND_RANK[a.vintage] ?? 0))[0] ?? null;
  const newer = newest && latest && newest.obs_id !== latest.obs_id && !newest.reader.showsValue ? newest : !latest && newest ? newest : null;
  if (!latest) return { latest, newer, change: null, noChange: null };
  const op = series.unit === "percent" ? "chg" : "pct";
  const view = changeView(op, dmeta(series), all.map(dinput));
  const point = view.points.find((p) => p.in[0] === latest.obs_id) ?? null;
  if (point && point.v !== null && point.in[1]) {
    const against = db().obsById.get(point.in[1]);
    if (against) return { latest, newer, change: { op, point, against }, noChange: null };
  }
  return { latest, newer, change: null, noChange: point?.why ?? null };
}

/* ---------- source marker ("ABS 2026-27, p. 11") ---------- */

const DOC_SHORT: Record<string, string> = {
  abs: "ABS",
  cpi_monthly_review: "CPI Monthly Review",
  lfs_annual_report: "LFS",
  pes_chapter: "Economic Survey",
  sbp_easydata: "SBP EasyData",
};

export type Marker = { doc: string; period: string; frequency: string; page: string | null; href: string; slug: string };

export function markerOf(o: Observation): Marker | null {
  const d = db();
  const c = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
  const s = c ? d.sourceById.get(c.source_id) : undefined;
  if (!c || !s) return null;
  const page = c.page_label && c.page_label !== String(c.page) ? `p. ${c.page_label}` : `p. ${c.page}`;
  return { doc: DOC_SHORT[s.doc_type] ?? s.publisher, period: s.period, frequency: /^\d{4}-\d{2}$/.test(s.period) && s.doc_type.startsWith("cpi") ? "month" : "fiscal_year", page, href: obsHref(o.obs_id), slug: slugify(o.obs_id) };
}

/* ---------- documents the series is printed in ---------- */

export type DocUse = { sourceId: string; title: string; publisher: string; period: string; pages: { page: number; label: string }[]; n: number };

export function documentsOf(series: Series): DocUse[] {
  const d = db();
  const by = new Map<string, DocUse>();
  for (const o of d.obsBySeries.get(series.series_id) ?? []) {
    const ids = [o.primary_cell_id, ...o.supporting_cell_ids].filter((x): x is string => !!x);
    for (const id of ids.slice(0, 1)) {
      const c = d.cellById.get(id);
      const s = c ? d.sourceById.get(c.source_id) : undefined;
      if (!c || !s) continue;
      const e = by.get(s.source_id) ?? { sourceId: s.source_id, title: s.title, publisher: s.publisher, period: s.period, pages: [], n: 0 };
      if (o.published && o.value !== null) e.n++;
      if (!e.pages.some((p) => p.page === c.page)) e.pages.push({ page: c.page, label: c.page_label && c.page_label !== String(c.page) ? `p. ${c.page_label} (PDF p. ${c.page})` : `p. ${c.page}` });
      by.set(s.source_id, e);
    }
  }
  return [...by.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/** Labels as printed in the documents (row labels of the figure's own cells), most recent first. */
export function printedLabels(series: Series): string[] {
  const d = db();
  const seen: string[] = [];
  const obs = [...(d.obsBySeries.get(series.series_id) ?? [])].sort((a, b) => b.period.localeCompare(a.period));
  for (const o of obs) {
    const c = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
    const l = c?.row_label_raw?.replace(/\s+/g, " ").trim();
    if (l && !seen.includes(l)) seen.push(l);
  }
  return seen;
}

/* ---------- chart models for the default render ---------- */

export function printedModels(series: Series): { best: ChartModel | null; kind: ChartModel } {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const kind = chartModelFrom(series, all);
  return { kind, best: hasBudgetPair(series) ? bestModelFrom(series, all) : null };
}

/* ---------- decoded series id (ECB; DESIGN.md 9.5 item 7) ---------- */

const SEG: Record<string, string> = {
  fed: "federal government",
  exp: "expenditure",
  rec: "receipts",
  current: "current expenditure",
  development: "development expenditure",
  total: "total",
  revenue_account: "on revenue account",
  capital_account: "on capital account",
  function: "by function",
  psdp: "Public Sector Development Programme",
  cpi: "consumer price index",
  national: "national",
  urban: "urban",
  rural: "rural",
  yoy: "change over the same month a year earlier",
  mom: "change over the previous month",
  index: "index level",
  group: "group",
  general: "all groups",
  weight: "weight in the basket",
  lfs: "Labour Force Survey",
  male: "men",
  female: "women",
  pb: "Punjab",
  sd: "Sindh",
  kp: "Khyber Pakhtunkhwa",
  ba: "Balochistan",
  share_of_total: "share of total expenditure",
};

/** The id split into its parts, each with its meaning in words where we know it. */
export function decodeId(id: string): { part: string; meaning: string }[] {
  return id.split(".").map((part) => {
    const base = /^b(\d{4})_(\d{2})$/.exec(part);
    if (base) return { part, meaning: `base year ${base[1]}-${base[2]}` };
    if (part === "icls19") return { part, meaning: "19th ICLS definitions" };
    return { part, meaning: SEG[part] ?? part.replaceAll("_", " ") };
  });
}

export function obsHrefOf(o: Observation): string {
  return obsHref(o.obs_id);
}
