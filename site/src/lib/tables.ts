// Tables as printed. Every printed number in the release is a cell with its
// document, page, table, row and column, the labels printed beside it and its
// box on the page (cells.json). Grouping cells by (document, page, table)
// rebuilds each table's grid as the government printed it.
//
// What a cell shows (AGENTS.md sections 3 and 4): its printed text only when
// it backs a published (checked) figure; a status mark when it backs a gap;
// nothing ("·") when no series uses it. Labels are the printed labels.
import { db, isDatasetPublished, slugify, type Cell, type Observation } from "./data";

export type PrintedTable = {
  slug: string;
  sourceId: string;
  page: number;
  pageLabel: string | null;
  tableIndex: number;
  extractor: string;
  runId: string;
  title: string;
  /** How many tables the release holds on this page (for "table 2 on the page"). */
  onPage: number;
  dataset: string | null;
  cells: Cell[];
  rows: { index: number; label: string | null }[];
  cols: { index: number; label: string | null }[];
  tableBox: number[] | null;
  published: number;
};

let cache: PrintedTable[] | null = null;
let obsOfCell: Map<string, Observation> | null = null;

/** The observation a cell backs (as primary or as another printing). */
export function cellObs(cellId: string): Observation | undefined {
  if (!obsOfCell) {
    obsOfCell = new Map();
    for (const o of db().observations) {
      if (o.primary_cell_id) obsOfCell.set(o.primary_cell_id, o);
      for (const c of o.supporting_cell_ids) if (!obsOfCell.has(c)) obsOfCell.set(c, o);
    }
  }
  return obsOfCell.get(cellId);
}

export const tableSlug = (sourceId: string, page: number, tableIndex: number) => slugify(`${sourceId}~p${page}~t${tableIndex}`);
export const tableHref = (sourceId: string, page: number, tableIndex: number) => `/tables/${tableSlug(sourceId, page, tableIndex)}`;
export const tableHrefOf = (c: Pick<Cell, "source_id" | "page" | "table_index">) => tableHref(c.source_id, c.page, c.table_index);

function mostCommon(xs: (string | null)[]): string | null {
  const n = new Map<string, number>();
  for (const x of xs) if (x && x.trim()) n.set(x.trim(), (n.get(x.trim()) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function printedTables(): PrintedTable[] {
  if (cache) return cache;
  const d = db();
  const groups = new Map<string, Cell[]>();
  for (const c of d.cells) {
    const k = `${c.source_id}|${c.page}|${c.table_index}|${c.extractor_name}`;
    const list = groups.get(k) ?? [];
    list.push(c);
    groups.set(k, list);
  }
  // Where a table was read twice (a flagged table re-read by the second tool),
  // keep the reading whose cells back published figures.
  const best = new Map<string, Cell[]>();
  const score = (cs: Cell[]) => cs.filter((c) => cellObs(c.cell_id)?.published).length;
  for (const cs of groups.values()) {
    const k = `${cs[0].source_id}|${cs[0].page}|${cs[0].table_index}`;
    const cur = best.get(k);
    if (!cur || score(cs) > score(cur) || (score(cs) === score(cur) && cs.length > cur.length)) best.set(k, cs);
  }
  const perPage = new Map<string, number>();
  for (const k of best.keys()) {
    const [s, p] = k.split("|");
    perPage.set(`${s}|${p}`, (perPage.get(`${s}|${p}`) ?? 0) + 1);
  }
  const out: PrintedTable[] = [];
  for (const cs of best.values()) {
    const c0 = cs[0];
    const rows = [...new Set(cs.map((c) => c.row_index))].sort((a, b) => a - b).map((i) => ({ index: i, label: mostCommon(cs.filter((c) => c.row_index === i).map((c) => c.row_label_raw)) }));
    const cols = [...new Set(cs.map((c) => c.col_index))].sort((a, b) => a - b).map((i) => ({ index: i, label: mostCommon(cs.filter((c) => c.col_index === i).map((c) => c.col_label_raw)) }));
    const titled = d.coverage.filter((r) => r.source_id === c0.source_id && r.page === c0.page);
    const datasets = [...new Set(cs.map((c) => (c.series_id ? d.seriesById.get(c.series_id)?.dataset : undefined)).filter((x): x is string => !!x))];
    out.push({
      slug: tableSlug(c0.source_id, c0.page, c0.table_index),
      sourceId: c0.source_id,
      page: c0.page,
      pageLabel: c0.page_label ?? null,
      tableIndex: c0.table_index,
      extractor: `${c0.extractor_name} ${c0.extractor_version}`,
      runId: c0.run_id,
      title: titled[0]?.table ?? "Table",
      onPage: perPage.get(`${c0.source_id}|${c0.page}`) ?? 1,
      dataset: datasets[0] ?? null,
      cells: cs,
      rows,
      cols,
      tableBox: cs.find((c) => c.table_bbox_norm)?.table_bbox_norm ?? null,
      published: score(cs),
    });
  }
  out.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.page - b.page || a.tableIndex - b.tableIndex);
  cache = out;
  return out;
}

/** Tables a visitor may open: those of published data types. */
export function visibleTables(): PrintedTable[] {
  return printedTables().filter((t) => t.dataset && isDatasetPublished(t.dataset));
}

export function tableBySlug(slug: string): PrintedTable | undefined {
  return printedTables().find((t) => t.slug === slug || t.slug === decodeURIComponent(slug));
}

export function tablesOfSource(sourceId: string): PrintedTable[] {
  return visibleTables().filter((t) => t.sourceId === sourceId);
}

/** The table a cell sits in, if it is one the site shows. */
export function tableOfCell(c: Pick<Cell, "source_id" | "page" | "table_index">): PrintedTable | undefined {
  const slug = tableSlug(c.source_id, c.page, c.table_index);
  return visibleTables().find((t) => t.slug === slug);
}
