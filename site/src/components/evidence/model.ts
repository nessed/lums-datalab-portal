// The evidence of one figure, computed once from the release (DESIGN.md 5.4,
// 7, 8.1). Used at build time by the receipt page (TSX) and by the prebuild
// step scripts/prebuild/evidence.mjs (plain Node with type stripping), so the
// page, the pre-cut crops and the one-tap sheet can never disagree.
//
// Plain TypeScript only: relative imports with .ts extensions, type-only
// imports from data.ts and the contract (erased by Node), no JSX, no fs.
import type { Cell, Check, Db, Observation, Series, Source } from "../../lib/data";
import { seriesTitle } from "../../lib/titles.ts";
import type { Evidence } from "../../lib/adapter/contract";
import { formatDecimalString, periodWords, unitLabel } from "../../lib/format.ts";
import { slugify } from "../../lib/ids.ts";
import { KIND } from "../../lib/words.ts";

/* ------------------------------------------------------------------ */
/* Proof state (5.4)                                                   */
/* ------------------------------------------------------------------ */

export type BoxState = "exact" | "tentative" | "none" | "no-image";
export type PrintedEvidence = Extract<Evidence, { kind: "printed-cell" }>;

const validBox = (b: number[] | null | undefined): b is number[] =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && Number.isFinite(n)) && b[2] > b[0] && b[3] > b[1];

/**
 * The contract's printed-cell evidence for one cell. Our release has only
 * exact (solid) boxes: a Docling cell box on a page render made from the
 * fingerprinted file. A cell without a box is "none"; a page with no render
 * is "no-image". "tentative" comes only from a golden release's proofs; the
 * display for it exists (ProofView) so a future adapter can reach it.
 */
export function printedEvidence(cell: Cell, hasImage: boolean): PrintedEvidence {
  const box = validBox(cell.cell_bbox_norm) ? (cell.cell_bbox_norm.slice(0, 4) as [number, number, number, number]) : null;
  return {
    kind: "printed-cell",
    sourceId: cell.source_id,
    page: cell.page,
    pageLabel: cell.page_label ?? null,
    box,
    boxState: !hasImage ? "no-image" : box ? "exact" : "none",
    printedText: cell.value_raw,
    cellId: cell.cell_id,
  };
}

/** The words of 5.4, exactly. */
export const PROOF_WORDS: Record<BoxState, string> = {
  exact: "Printed here",
  tentative: "We could not pin this figure to one place on the page. It is printed on this page; the dashed boxes show where it could be.",
  none: "This page is the source. We could not locate the figure on it automatically.",
  "no-image": "The page image could not be checked against the official file, so it is not shown.",
};

/** May the printed page be shown for this figure? For a value, and for a gap the
 * government did not print (the page shows the dash). Never for a figure that is
 * held back, not checked yet, or of unknown status: its reading is not published. */
export function pageAllowed(o: Observation, cell: Cell | undefined): boolean {
  if (!cell) return false;
  if (o.reader.showsValue && o.published && o.value !== null) return true;
  return o.reader.key === "not-printed" && !cell.value_parsed;
}

/* ------------------------------------------------------------------ */
/* Pre-cut crops                                                       */
/* ------------------------------------------------------------------ */

export type Pct = { left: string; top: string; width: string; height: string };
export type CropWin = {
  /** File name under <DATA_BASE>/evidence/crops/. */
  file: string;
  /** The rectangle cut from the page render, in pixels: [left, top, width, height]. */
  px: [number, number, number, number];
  /** "head": the column headings strip; "rows": the rows around the figure. */
  part: "head" | "rows";
  /** Which horizontal segment: 0 = the only one, or the row labels; 1 = the figure. */
  seg: number;
  /** The cell's box inside this window (percentages), when the box is in it. */
  box: Pct | null;
  /** The figure's row and column, lightly shaded, inside this window. */
  bands: Pct[];
};
export type CropPlan = { cellId: string; windows: CropWin[]; segments: number; hidden: number; head: boolean };

type Guides = { labelRight: number | null; prevLeft: number | null; rows: [number, number][]; rowIndex: number; cols: [number, number][]; header: [number, number] | null };

/** Geometry from the table's own cells, so a crop never cuts a number or a row
 * in half and can show the headings. Same rule as cropGuides() in data.ts. */
function guides(cell: Cell, sameSource: Cell[]): Guides {
  const b = cell.cell_bbox_norm;
  const same = sameSource.filter((c) => c.page === cell.page && c.table_index === cell.table_index && c.cell_bbox_norm);
  let min = Infinity;
  let prev: Cell | null = null;
  const rowMap = new Map<number, [number, number]>();
  const colMap = new Map<number, [number, number]>();
  for (const c of same) {
    const cb = c.cell_bbox_norm!;
    min = Math.min(min, cb[0]);
    if (b && c.row_index === cell.row_index && cb[2] <= b[0] + 0.002 && (!prev || cb[2] > prev.cell_bbox_norm![2])) prev = c;
    const r = rowMap.get(c.row_index);
    rowMap.set(c.row_index, r ? [Math.min(r[0], cb[1]), Math.max(r[1], cb[3])] : [cb[1], cb[3]]);
    const k = colMap.get(c.col_index);
    colMap.set(c.col_index, k ? [Math.min(k[0], cb[0]), Math.max(k[1], cb[2])] : [cb[0], cb[2]]);
  }
  const prevLeft = prev ? (colMap.get(prev.col_index)?.[0] ?? prev.cell_bbox_norm![0]) : null;
  const rows = [...rowMap.values()].sort((x, y) => x[0] - y[0]);
  const mid = b ? (b[1] + b[3]) / 2 : 0;
  const rowIndex = Math.max(0, rows.findIndex((r) => r[0] <= mid && r[1] >= mid));
  const t = cell.table_bbox_norm;
  const firstTop = rows.length ? rows[0][0] : null;
  const header: [number, number] | null = t && firstTop !== null && firstTop - t[1] > 0.012 ? [Math.max(t[1] - 0.004, firstTop - 0.075), firstTop - 0.002] : null;
  return { labelRight: Number.isFinite(min) ? min : null, prevLeft, rows, rowIndex, cols: [...colMap.values()].sort((x, y) => x[0] - y[0]), header };
}

const pc = (n: number) => `${Number((Math.min(100, Math.max(0, n * 100))).toFixed(4))}%`;
const pcFree = (n: number) => `${Number((n * 100).toFixed(4))}%`;

/** Rows either side of the figure's row in a crop. */
export const CROP_ROWS = 2;

/**
 * Where to cut the crop of one cell: whole rows only, the column headings as a
 * strip above when they are further up the page, and the printed row label.
 * When label and figure do not fit one magnified window, two windows at the
 * same scale (the label column; the figure and its neighbour), with the number
 * of columns left out between them. Same rule as DocCrop in PageFrame.tsx.
 * Only ever for an exact (solid) box.
 */
export function cropPlan(cell: Cell, sameSource: Cell[], image: { width: number; height: number }): CropPlan | null {
  const b = cell.cell_bbox_norm;
  if (!validBox(b) || !(image.width > 0) || !(image.height > 0)) return null;
  const g = guides(cell, sameSource);
  const t = validBox(cell.table_bbox_norm) ? cell.table_bbox_norm : [0, 0, 1, 1];
  const right = Math.min(1, b[2] + 0.02);
  const tableLeft = Math.max(0, t[0] - 0.006);
  const MAX = 0.36;
  const lr = g.labelRight && g.labelRight > tableLeft && g.labelRight < b[0] ? g.labelRight + 0.006 : null;
  let segments: [number, number][];
  let hidden = 0;
  if (right - tableLeft <= MAX || !lr) {
    segments = [[Math.max(tableLeft, right - MAX), right]];
  } else {
    const labelEnd = Math.min(lr, tableLeft + 0.25);
    const prev = g.prevLeft;
    const valueLeft = Math.max(labelEnd, prev !== null && b[0] - prev < 0.2 ? prev - 0.008 : b[0] - 0.05);
    if (valueLeft - labelEnd < 0.02) segments = [[tableLeft, Math.max(right, tableLeft + MAX)]];
    else {
      segments = [
        [tableLeft, labelEnd],
        [valueLeft, right],
      ];
      hidden = g.cols.filter(([l, r]) => l >= labelEnd - 0.002 && r <= valueLeft + 0.002).length;
    }
  }
  let y0: number;
  let y1: number;
  const i = g.rowIndex;
  if (g.rows.length > 0 && i >= 0 && i < g.rows.length) {
    const a = g.rows[Math.max(0, i - CROP_ROWS)];
    const z = g.rows[Math.min(g.rows.length - 1, i + CROP_ROWS)];
    y0 = Math.max(0, a[0] - 0.006);
    y1 = Math.min(1, z[1] + 0.006);
  } else {
    const h = Math.max(b[3] - b[1], 0.008);
    y0 = Math.max(0, b[1] - h * (CROP_ROWS + 0.6));
    y1 = Math.min(1, b[3] + h * (CROP_ROWS + 0.6));
  }
  const head = g.header && g.header[1] < y0 - 0.004 ? g.header : null;
  const W = image.width;
  const H = image.height;
  const box = [Math.max(0, b[0] - 0.004), Math.max(0, b[1] - 0.004), Math.min(1, b[2] + 0.004), Math.min(1, b[3] + 0.004)];
  const rowBand = validBox(t) ? [t[0] - 0.003, b[1] - 0.003, t[2] + 0.003, b[3] + 0.003] : null;
  const colBand = validBox(t) ? [b[0] - 0.003, t[1] - 0.003, b[2] + 0.003, t[3] + 0.003] : null;
  const windows: CropWin[] = [];
  const rel = (r: number[], L: number, T: number, w: number, h: number, clamp: boolean): Pct => {
    const f = clamp ? pc : pcFree;
    const x0 = (r[0] * W - L) / w;
    const y0r = (r[1] * H - T) / h;
    const x1 = (r[2] * W - L) / w;
    const y1r = (r[3] * H - T) / h;
    return clamp
      ? { left: f(x0), top: f(y0r), width: f(Math.min(1, x1) - Math.max(0, x0)), height: f(Math.min(1, y1r) - Math.max(0, y0r)) }
      : { left: f(x0), top: f(y0r), width: f(x1 - x0), height: f(y1r - y0r) };
  };
  segments.forEach(([x0, x1], seg) => {
    const parts: ["head" | "rows", number, number][] = head ? [["head", head[0], head[1]], ["rows", y0, y1]] : [["rows", y0, y1]];
    for (const [part, a0, a1] of parts) {
      const L = Math.max(0, Math.floor(x0 * W));
      const T = Math.max(0, Math.floor(a0 * H));
      const w = Math.min(W, Math.ceil(x1 * W)) - L;
      const h = Math.min(H, Math.ceil(a1 * H)) - T;
      if (w < 4 || h < 4) continue;
      const cx = ((b[0] + b[2]) / 2) * W;
      const cy = ((b[1] + b[3]) / 2) * H;
      const inside = cx >= L && cx <= L + w && cy >= T && cy <= T + h;
      const bands: Pct[] = [];
      if (rowBand && part === "rows") bands.push(rel(rowBand, L, T, w, h, false));
      if (colBand) bands.push(rel(colBand, L, T, w, h, false));
      windows.push({ file: `${cell.cell_id}-${windows.length}.webp`, px: [L, T, w, h], part, seg, box: inside ? rel(box, L, T, w, h, true) : null, bands });
    }
  });
  if (!windows.some((w) => w.box)) return null;
  return { cellId: cell.cell_id, windows, segments: segments.length, hidden, head: !!head };
}

/* ------------------------------------------------------------------ */
/* The verdict sentence (7.1): specific, never vague                    */
/* ------------------------------------------------------------------ */

const TIMES = ["", "once", "twice", "three times", "four times", "five times", "six times", "seven times", "eight times", "nine times", "ten times", "eleven times", "twelve times"];
const isPass = (c: Check) => c.result === "pass" || c.result === "pass_within_rounding";

function titleOf(db: Db, sourceId: string | null | undefined): string | null {
  if (!sourceId) return null;
  return db.sourceById.get(sourceId)?.title ?? null;
}

/** The other side of a comparison check: the cell that is not this figure's own. */
function otherSide(db: Db, c: Check, o: Observation): Cell | undefined {
  const own = new Set([o.primary_cell_id, ...o.supporting_cell_ids].filter(Boolean) as string[]);
  const ids = [...c.member_cell_ids, ...(c.target_cell_id ? [c.target_cell_id] : [])];
  const other = ids.find((id) => !own.has(id) && db.cellById.has(id)) ?? ids.find((id) => id !== o.primary_cell_id && db.cellById.has(id));
  return other ? db.cellById.get(other) : undefined;
}

/** One plain clause per passing check: what it showed, with no figure in it. */
export function passClause(db: Db, c: Check, o: Observation): string {
  const ownSrc = o.primary_cell_id ? db.cellById.get(o.primary_cell_id)?.source_id : undefined;
  const isTotal = !!c.target_cell_id && (c.target_cell_id === o.primary_cell_id || o.supporting_cell_ids.includes(c.target_cell_id));
  switch (c.check_type) {
    case "column_total":
    case "hierarchy_sum":
      return isTotal ? "the lines that make it up add up to it" : "it adds up with the other lines of its table to the printed total";
    case "row_total":
      return isTotal ? "the columns that make it up add up to it" : "it adds up with the other columns of its row to the printed total";
    case "accounting_identity":
      return "it fits an accounting identity printed in the same table";
    case "cross_edition": {
      const other = otherSide(db, c, o);
      const t = titleOf(db, other?.source_id);
      return other && other.source_id !== ownSrc && t ? `${t} prints the same figure` : "another edition prints the same figure";
    }
    case "cross_table": {
      const other = otherSide(db, c, o);
      const t = titleOf(db, other?.source_id);
      return other && other.source_id === ownSrc ? "another table in the same document prints the same figure" : t ? `another table, in ${t}, prints the same figure` : "another table prints the same figure";
    }
    case "cross_source": {
      const t = titleOf(db, c.target_source) ?? titleOf(db, otherSide(db, c, o)?.source_id);
      return t ? `${t} publishes the same figure` : "another official source publishes the same figure";
    }
    case "index_aggregation":
      return "recomputing the weighted average of its groups gives the same index";
    case "recompute":
      return "recomputing it from its printed parts gives the same figure";
    case "weights_sum":
      return "the weights of its basket add up";
    default:
      return c.check_type.replaceAll("_", " ") + " passed";
  }
}

function failClause(c: Check): string {
  switch (c.check_type) {
    case "column_total":
    case "hierarchy_sum":
      return "the lines of its table do not add up to the printed total";
    case "row_total":
      return "the columns of its row do not add up to the printed total";
    case "accounting_identity":
      return "an accounting identity printed in its table does not hold";
    case "cross_edition":
      return "another edition prints a different figure for the same line and year";
    case "cross_table":
      return "another table prints a different figure for it";
    case "cross_source":
      return "another official source publishes a different figure";
    case "recompute":
      return "recomputing it from its printed parts gives a different figure";
    case "index_aggregation":
      return "recomputing the weighted average of its groups gives a different index";
    case "weights_sum":
      return "the weights of its basket do not add up";
    default:
      return `the ${c.check_type.replaceAll("_", " ")} check failed`;
  }
}

function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Disputed printings: the documents, in the order printed. */
function disputedSources(db: Db, o: Observation): string[] {
  const raw = (o as Observation & { disputed_readings?: unknown }).disputed_readings;
  const ids: string[] = [];
  if (Array.isArray(raw)) for (const r of raw) if (r && typeof r === "object" && typeof (r as { source_id?: unknown }).source_id === "string") ids.push((r as { source_id: string }).source_id);
  if (ids.length === 0) for (const id of [o.primary_cell_id, ...o.supporting_cell_ids]) if (id && db.cellById.get(id)) ids.push(db.cellById.get(id)!.source_id);
  return [...new Set(ids)].map((id) => titleOf(db, id) ?? id);
}

/**
 * One verdict sentence. For a shown value it names what the checks showed (and
 * only source titles carry digits); for a gap it says why, with no figure in it.
 * Built from o.reader (the adapter's decision) and the figure's own checks.
 */
export function verdict(db: Db, o: Observation): string {
  const checks = o.check_ids.map((id) => db.checkById.get(id)).filter((c): c is Check => !!c);
  const r = o.reader;
  if (r.showsValue && o.published && o.value !== null) {
    const s = db.seriesById.get(o.series_id);
    if (s?.derived) {
      return "Computed by code from checked figures, each with its own receipt; the government does not print this figure.";
    }
    const counted = checks.filter((c) => isPass(c) && c.official !== false && c.credits_members !== false && c.check_type !== "reference_value");
    const clauses: string[] = [];
    const rounding = new Map<string, boolean>();
    // Second printings are one clause naming every place: "it is printed the
    // same in another table of this document and in Annual Budget Statement 2026-27".
    const places: string[] = [];
    const ownSrc = o.primary_cell_id ? db.cellById.get(o.primary_cell_id)?.source_id : undefined;
    for (const c of counted) {
      if (c.check_type === "cross_edition" || c.check_type === "cross_table") {
        const other = otherSide(db, c, o);
        const p = !other ? "another printing" : other.source_id === ownSrc ? "another table of this document" : (titleOf(db, other.source_id) ?? "another edition");
        if (!places.includes(p)) places.push(p);
        continue;
      }
      const k = passClause(db, c, o);
      if (!clauses.includes(k)) clauses.push(k);
      rounding.set(k, (rounding.get(k) ?? true) && c.result === "pass_within_rounding");
    }
    const parts = clauses.map((k) => (rounding.get(k) ? `${k} (allowing for rounding)` : k));
    if (places.length) parts.push(`it is printed the same ${joinAnd(places.map((p) => `in ${p}`))}`);
    const n = counted.length;
    const list = parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
    let head = n === 0 ? r.reason : `Checked ${TIMES[n] ?? "in several ways"}: ${list}.`;
    if (r.key === "candidate") head = `Not signed off: a person has not yet approved this dataset. ${head}`;
    if (r.key === "checked-note") head = `${head} The document attaches a note to this figure.`;
    if (r.key === "revised") head = `Revised: a later printing replaced this figure. ${head}`;
    return head;
  }
  const cell = o.primary_cell_id ? db.cellById.get(o.primary_cell_id) : undefined;
  switch (r.key) {
    case "disputed": {
      const docs = disputedSources(db, o);
      return docs.length >= 2
        ? `Disputed: ${joinAnd(docs)} print different figures for this line and year, and each adds up in its own table. We show every printing and choose none.`
        : "Disputed: two official printings give different figures for this line and year, and each adds up in its own table. We show every printing and choose none.";
    }
    case "not-printed": {
      const raw = (cell?.value_raw ?? "").trim();
      if (!raw) return "Not printed: the document leaves this cell blank. We show no number, and we do not read a blank as zero.";
      if (/^[-‐‑‒–—―−]+$/.test(raw)) return "Not printed: the document prints a dash here, not a number. We do not read a dash as zero.";
      if (!/\d/.test(raw)) return `Not printed: the document prints “${raw}” here, not a number. We show no number and do not read it as zero.`;
      return r.reason;
    }
    case "held": {
      const failed = checks.filter((c) => c.result === "fail");
      const cl = [...new Set(failed.map(failClause))];
      if (cl.length) return `Held back: ${joinAnd(cl)}, and nothing independent says which number is wrong, so we show none.`;
      if (checks.some((c) => c.result === "not_evaluable"))
        return /flag/i.test(o.gap_reason ?? "")
          ? "Held back: the table it is printed in was flagged when it was read, so its checks could not be run and no number is shown."
          : "Held back: its checks could not be run on the printed table, so no number is shown.";
      return `Held back: ${r.reason.charAt(0).toLowerCase()}${r.reason.slice(1)}`;
    }
    case "not-checked": {
      const ne = checks.filter((c) => c.result === "not_evaluable");
      return ne.length
        ? "Not checked yet: we have read this figure, but the check that covers it could not be run on this table, so no number is shown."
        : "Not checked yet: we have read this figure, but no check covers it yet, so no number is shown.";
    }
    default:
      return r.reason;
  }
}

/* ------------------------------------------------------------------ */
/* Versions of this figure (8.1)                                        */
/* ------------------------------------------------------------------ */

export type VersionItem = {
  obsId: string;
  slug: string;
  /** "Budget estimate", "Revised estimate", "As printed" ... */
  kindWord: string;
  period: string;
  periodWords: string;
  /** Documents that print it: the primary first, then other editions that print it again. */
  printedIn: { sourceId: string; title: string }[];
  /** Stored value, only where the reader status shows one. */
  value: string | null;
  unit: string;
  /** Status word when no value is shown ("held back", "not printed" ...). */
  word: string | null;
  usable: boolean;
  isThis: boolean;
};
export type VersionStep = {
  from: string;
  to: string;
  /** "+88%" (U+2212 for minus), or null when not shown. */
  pct: string | null;
  /** "up" | "down" | "same" when pct is shown. */
  dir: "up" | "down" | "same" | null;
  /** Why the change is not shown, when it is not. */
  reason: string | null;
};
export type Versions = { items: VersionItem[]; steps: VersionStep[]; missing: string[] };

const KIND_ORDER = ["be", "re", "provisional", "actual", "ac", "final"];
const kindRank = (v: string) => (KIND_ORDER.indexOf(v) < 0 ? KIND_ORDER.length : KIND_ORDER.indexOf(v));

export function kindWord(o: Pick<Observation, "kind" | "vintage">): string {
  const k = KIND[o.kind];
  if (!k || o.kind === "as_printed") return "As printed";
  const w = k.long;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Round half away from zero of a / b for BigInt a, b (b > 0). */
function divRound(a: bigint, b: bigint): bigint {
  const neg = a < BigInt(0);
  const x = neg ? -a : a;
  const q = (x * BigInt(2) + b) / (b * BigInt(2));
  return neg ? -q : q;
}

function toScaled(v: string, dec: number): bigint | null {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) return null;
  const frac = (m[3] ?? "").padEnd(dec, "0");
  if (frac.length > dec) return null;
  const n = BigInt(m[2] + frac);
  return m[1] === "-" ? -n : n;
}

/**
 * Percentage change from a to b, from the stored decimal strings, no floating
 * point: whole per cent when the change is 10% or more either way, one decimal
 * below that; half away from zero. "+88%", "−4.2%", "0%". Null if a is zero or
 * either is not a plain decimal. scripts/checks/evidence-sheet.mjs recomputes it.
 */
export function pctChange(a: string, b: string): string | null {
  const da = (a.split(".")[1] ?? "").length;
  const dbb = (b.split(".")[1] ?? "").length;
  const dec = Math.max(da, dbb);
  const A = toScaled(a, dec);
  const B = toScaled(b, dec);
  if (A === null || B === null || A === BigInt(0)) return null;
  const diff = B - A;
  const absA = A < BigInt(0) ? -A : A;
  const absD = diff < BigInt(0) ? -diff : diff;
  // Sign follows the direction of change relative to the size of a.
  const num = A < BigInt(0) ? -diff : diff;
  let text: string;
  if (absD * BigInt(10) >= absA) {
    const p = divRound(num * BigInt(100), absA);
    text = `${p < BigInt(0) ? -p : p}`;
    text = p > BigInt(0) ? `+${text}%` : p < BigInt(0) ? `−${text}%` : "0%";
  } else {
    const p = divRound(num * BigInt(1000), absA);
    const ap = p < BigInt(0) ? -p : p;
    const s = `${ap / BigInt(10)}.${ap % BigInt(10)}`;
    text = p > BigInt(0) ? `+${s}%` : p < BigInt(0) ? `−${s}%` : "0%";
  }
  return text;
}

/**
 * Every printing of this series and period in the release, oldest first: other
 * kinds of figure (budget estimate, revised estimate, actual) and other editions
 * that print the same figure again (supporting cells in another document).
 */
export function versionsOf(db: Db, o: Observation): Versions {
  const s = db.seriesById.get(o.series_id);
  const same = (db.obsBySeries.get(o.series_id) ?? []).filter((x) => x.period === o.period);
  const srcOf = (x: Observation): Source | undefined => {
    const c = x.primary_cell_id ? db.cellById.get(x.primary_cell_id) : undefined;
    return c ? db.sourceById.get(c.source_id) : undefined;
  };
  const sorted = same.slice().sort((a, b) => kindRank(a.vintage) - kindRank(b.vintage) || (srcOf(a)?.period ?? "").localeCompare(srcOf(b)?.period ?? "") || a.obs_id.localeCompare(b.obs_id));
  const items: VersionItem[] = sorted.map((x) => {
    const primary = x.primary_cell_id ? db.cellById.get(x.primary_cell_id) : undefined;
    const printedIn: { sourceId: string; title: string }[] = [];
    const add = (sid: string | undefined) => {
      if (!sid || printedIn.some((p) => p.sourceId === sid)) return;
      printedIn.push({ sourceId: sid, title: titleOf(db, sid) ?? sid });
    };
    add(primary?.source_id);
    // Other editions print it again only where a check confirmed the reprint, i.e. for a shown value.
    if (x.reader.showsValue && x.published) for (const id of x.supporting_cell_ids) add(db.cellById.get(id)?.source_id);
    const shows = x.reader.showsValue && x.published && x.value !== null;
    return {
      obsId: x.obs_id,
      slug: slugify(x.obs_id),
      kindWord: kindWord(x),
      period: x.period,
      periodWords: periodWords(x.period, s?.frequency),
      printedIn: primary ? printedIn : [],
      value: shows ? x.value : null,
      unit: unitLabel(x.unit, x.scale_factor),
      word: shows ? (x.reader.word || null) : x.reader.word || "no value",
      usable: shows && x.reader.usableInDerived,
      isThis: x.obs_id === o.obs_id,
    };
  });
  const steps: VersionStep[] = [];
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1];
    const b = items[i];
    const oa = db.obsById.get(a.obsId)!;
    const ob = db.obsById.get(b.obsId)!;
    let pct: string | null = null;
    let reason: string | null = null;
    if (!a.value || !b.value) reason = `the ${(!a.value ? a : b).kindWord.toLowerCase()} is ${(!a.value ? a : b).word ?? "not shown"}, so no change is computed`;
    else if (!a.usable || !b.usable) reason = `the ${(!a.usable ? a : b).kindWord.toLowerCase()} is ${(!a.usable ? a : b).word || "not usable"}, so no change is computed`;
    else if (oa.unit !== ob.unit || oa.scale_factor !== ob.scale_factor) reason = "the two are in different units, so no change is computed";
    // A rate (a share, a per cent) is never given a per cent change of itself (tester finding: +131% on a share).
    else if (oa.unit === "percent") reason = "both are rates in per cent, so no percentage change is computed; the difference is in percentage points";
    else {
      pct = pctChange(a.value, b.value);
      if (!pct) reason = "the earlier figure is zero, so no percentage change exists";
    }
    const dir = pct ? (pct.startsWith("+") ? "up" : pct.startsWith("−") ? "down" : "same") : null;
    steps.push({ from: a.obsId, to: b.obsId, pct, dir, reason });
  }
  const missing: string[] = [];
  // Budget lines move from estimate to revised estimate to actual; say which stage this release lacks.
  if (same.some((x) => x.vintage === "be" || x.vintage === "re")) {
    if (!same.some((x) => x.vintage === "re")) missing.push("Revised estimate: not yet in this release");
    if (!same.some((x) => x.vintage === "actual" || x.vintage === "ac")) missing.push("Actual: not yet in this release");
  }
  return { items, steps, missing };
}

/* ------------------------------------------------------------------ */
/* The one-tap sheet (7): the small JSON the browser fetches             */
/* ------------------------------------------------------------------ */

export type SheetData = {
  v: 1;
  release: string;
  obs: string;
  slug: string;
  href: string;
  cite: string;
  title: string;
  kind: string;
  period: string;
  /** Stored value with thousands separators, and its unit. Only for a shown value. */
  value: string | null;
  unit: string;
  verdict: string;
  boxState: BoxState | null;
  proofWords: string | null;
  doc: { title: string; href: string; pdf: string | null; archive: string | null } | null;
  page: { pdf: number; printed: string | null } | null;
  row: string | null;
  col: string | null;
  /** The cell's text as printed. Only for a shown value. */
  printed: string | null;
  crop: (CropPlan & { base: string }) | null;
  versions: Versions;
};

export function officialWorks(src: Source | undefined): boolean {
  return !!src && !(src.verification_status ?? "").startsWith("wayback") && src.verification_status !== "archive_copy_content_inspected";
}

/** The official PDF at the figure's page (#page=N is honoured by browser PDF viewers). */
export function pdfAtPage(src: Source | undefined, page: number | null | undefined): string | null {
  if (!src?.file_url || !officialWorks(src)) return null;
  return page ? `${src.file_url}#page=${page}` : src.file_url;
}

export function sheetData(db: Db, o: Observation, opts: { dataBase: string; crop: CropPlan | null; hasImage: boolean }): SheetData {
  const s: Series | undefined = db.seriesById.get(o.series_id);
  const cell = o.primary_cell_id ? db.cellById.get(o.primary_cell_id) : undefined;
  const src = cell ? db.sourceById.get(cell.source_id) : undefined;
  const shows = o.reader.showsValue && o.published && o.value !== null;
  const allowed = pageAllowed(o, cell);
  const ev = cell && allowed ? printedEvidence(cell, opts.hasImage) : null;
  const slug = slugify(o.obs_id);
  return {
    v: 1,
    release: db.release.version,
    obs: o.obs_id,
    slug,
    href: `/o/${slug}`,
    cite: `/o/${slug}#cite`,
    // The plain title (editorial/titles.json); the printed name is on the receipt one tap further.
    title: s ? seriesTitle(s) : o.series_id,
    kind: kindWord(o),
    period: periodWords(o.period, s?.frequency),
    value: shows ? formatDecimalString(o.value) : null,
    unit: unitLabel(o.unit, o.scale_factor),
    verdict: verdict(db, o),
    boxState: ev ? ev.boxState : null,
    proofWords: ev ? PROOF_WORDS[ev.boxState] : null,
    doc: src ? { title: src.title, href: `/sources/${slugify(src.source_id)}`, pdf: allowed ? pdfAtPage(src, cell?.page) : null, archive: allowed ? src.wayback_url : null } : null,
    page: cell && allowed ? { pdf: cell.page, printed: cell.page_label && cell.page_label !== String(cell.page) ? cell.page_label : null } : null,
    row: cell && allowed ? cell.row_label_raw : null,
    col: cell && allowed ? cell.col_label_raw : null,
    printed: shows && cell ? cell.value_raw : null,
    crop: ev && ev.boxState === "exact" && opts.crop ? { ...opts.crop, base: `${opts.dataBase}/evidence/crops/` } : null,
    versions: versionsOf(db, o),
  };
}
