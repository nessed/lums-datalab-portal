// The data contract (DESIGN.md section 5.1). Every page reads data only
// through an adapter that produces these shapes; nothing on the site knows
// where a release came from. Two adapters exist:
//   datalab  our own release (releases/<version>/), the source tonight
//   golden   a tagged golden release of Ahmad's repository (not switched on)
// The adapter decides a figure's reader status; pages only display it.
//
// The record shapes keep the field names of our release (series_id, obs_id,
// vintage, published, gap_kind ...) because every page was written against
// them; the contract adds what the brief asks for on top: the kind of figure,
// the reader status with its reason, the printed text, the sign-off state and
// batch gaps. A golden adapter fills the same fields from its own rows.

/* ---------- vocabulary ---------- */

/** Reader statuses (DESIGN.md 6.1). Mapping from each source's own words lives in its adapter. */
export type ReaderStatusKey =
  | "checked" // value, unmarked
  | "checked-note" // value + "note"
  | "candidate" // value + "not signed off" (decision 17.1: shown, marked, kept out of headlines)
  | "revised" // value + "revised" (a later printing replaced an earlier one)
  | "disputed" // no single value; both printings on the receipt
  | "held" // no value ("held back"): failed a check
  | "not-checked" // no value: read, no check covers it yet
  | "not-printed" // no value: the document prints a dash or a blank
  | "dash-or-zero" // no value: the source stored 0 for a printed dash or zero and does not say which (decision 17.3)
  | "unknown"; // a status this code does not know: no value, raw label

export type ReaderStatus = {
  key: ReaderStatusKey;
  /** One word or two, shown at a glance only when not "checked". */
  word: string;
  /** One specific sentence: why this figure is shown this way. */
  reason: string;
  /** May a number be shown for this figure? */
  showsValue: boolean;
  /** May this figure feed a derived value (a change, a share, a sum)? Only checked figures may. */
  usableInDerived: boolean;
};

/** Kinds of figure (DESIGN.md 6.2). Extensible: a new kind is one entry in words.ts. */
export type KindKey =
  | "be" // budget estimate
  | "re" // revised estimate
  | "actual" // actual, as printed in the Demands for Grants book (not final outturn)
  | "ac" // provincial accounts for a past year (not audited)
  | "provisional"
  | "final" // Economic Survey column flag F
  | "es_revised" // Economic Survey column flag R
  | "es_provisional" // Economic Survey column flag P
  | "part_year" // July to March and similar
  | "index" // a price index level
  | "change_yoy" // change over the same month a year earlier
  | "change_mom" // change over the previous month
  | "weight" // weight in a basket
  | "survey_round" // a labour force or household survey round
  | "as_printed"; // a figure with no stage

export type SignOff = "signed" | "candidate" | "not-applicable";

/* ---------- records ---------- */

export type SeriesBreak = { at_period: string; kind: string; note: string };

export type ReleaseInfo = {
  /** "v0.0.1-prototype" or "golden-2026.11.11". */
  id: string;
  /** Which adapter built it, in words: "LUMS DataLab pipeline" or "Golden data release". */
  builtFrom: string;
  frozenAt: string;
  licence: string;
  isLatest: boolean;
  isPrototype: boolean;
};

/** A whole batch with no rows (a held budget year or survey round). */
export type BatchGap = { dataset: string; batch: string; status: ReaderStatusKey; reason: string };

/** Evidence of one figure (DESIGN.md 5.1). Our release has only printed cells. */
export type Evidence =
  | {
      kind: "printed-cell";
      sourceId: string;
      page: number;
      pageLabel: string | null;
      /** Box on the page as fractions [x0, y0, x1, y1]. */
      box: [number, number, number, number] | null;
      /** "exact": a solid box; "tentative": dashed candidates; "none": not placed; "no-image". */
      boxState: "exact" | "tentative" | "none" | "no-image";
      printedText: string | null;
      cellId: string | null;
    }
  | { kind: "recomputed"; ourValue: string; publishedValue: string | null; sourceId: string; table: string; page: number | null; method: string }
  | { kind: "derived"; formula: string; inputs: string[] };

/* ---------- the adapter ---------- */

export type AdapterName = "datalab" | "golden";

/* ---------- plain titles (DESIGN.md 6.4, round 2) ---------- */

/**
 * Where a series' reader title comes from:
 *   "approved"  editorial/titles.json, approved by a person;
 *   "draft"     editorial/titles.json, drafted and not yet approved (everything today);
 *   "printed"   no entry: the title is the printed name, unchanged (the golden adapter
 *               for every series, the datalab adapter for a series the file does not cover).
 * The printed name itself always stays on the series as `name`.
 */
export type TitleStatus = "approved" | "draft" | "printed";

/** What the adapter adds to every series: a short plain title, a one-sentence summary and where they come from. */
export type SeriesTitleFields = {
  /** Short plain title ("Inflation", "Federal health spending (current)"); the printed name when there is no entry. */
  title: string;
  /** One sentence, no digits; null when there is no entry (pages then show the definition). */
  summary: string | null;
  titleStatus: TitleStatus;
};
