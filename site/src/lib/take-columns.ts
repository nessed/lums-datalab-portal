// Columns of the downloadable files (DESIGN.md 13.1), with what each holds.
// Pure data, no imports: read by the file generator (scripts/prebuild/take.mjs),
// which writes these words into every README, and by the Data page.

export const LONG_COLUMNS: [string, string][] = [
  ["series_id", "Stable id of the series. Never changes meaning once published."],
  ["series_name", "The series in plain words."],
  ["period", "Fiscal year (July to June, written 2025-26), month (2026-06) or survey round, as the document labels it."],
  ["kind", "Kind of figure in words: budget estimate, revised estimate, actual, index, survey round and so on."],
  ["kind_code", "The same as a short code (be, re, actual, index, change_yoy, survey_round ...)."],
  ["printed_in", "The document this printing comes from (title and edition)."],
  ["edition", "The edition of that document."],
  ["publisher", "Who published the document."],
  ["page", "The page as printed on the page itself, else the page of the PDF file."],
  ["pdf_page", "The page of the PDF file."],
  ["value_as_printed", "The text exactly as printed, for figures that passed their checks. A printed dash is kept as a dash. Empty for every other figure."],
  ["value", "The figure as an exact decimal, in the unit and scale given. Empty unless the figure passed its checks: held-back, disputed, unchecked and unprinted figures have an empty value, never a zero."],
  ["unit", "The unit in words, for example Rs million, per cent, index points, million persons."],
  ["unit_code", "The unit as a code (PKR, percent, index, persons)."],
  ["scale_factor", "Multiply value by this to get the full amount (1000000 for millions)."],
  ["status", "checked; checked, with a note; not signed off; revised; disputed; held back; not checked yet; not printed. Always its own column."],
  ["status_code", "The same as a code."],
  ["status_reason", "One sentence: why the figure is shown this way."],
  ["release", "The release this row comes from."],
  ["receipt_url", "The figure's receipt, pinned to this release: the printed page, the box on it and every check."],
  ["obs_id", "Permanent id of the figure: series_id:period:kind."],
  ["source_id", "Id of the document."],
  ["source_url", "Official address of the document."],
  ["source_sha256", "SHA-256 fingerprint of the document file that was read."],
  ["cell_id", "Id of the printed cell that was read."],
  ["generated", "Date this file was generated."],
  ["licence", "Licence of this file."],
  ["citation", "How to cite this figure: the document first, then the release."],
  ["is_this_current", "Open this address to see whether any figure in this file was corrected in a later release."],
];

/** Extra and changed columns in the version files of a multi-printing series. */
export const VERSION_FILES: { key: "latest" | "first" | "printings" | "vintages"; label: string; what: string }[] = [
  { key: "latest", label: "Latest printing only", what: "One row per figure, as printed in the newest edition that prints it." },
  { key: "first", label: "As first printed", what: "One row per figure, as printed in the oldest edition that prints it." },
  { key: "printings", label: "Every printing (long)", what: "One row per printing of each figure; printed_in names the edition. value is that printing's own reading." },
  { key: "vintages", label: "Vintage grid", what: "One row per period, one column per edition (and kind of figure), with a status column beside each." },
];
