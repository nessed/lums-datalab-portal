// Catalogue facets: how each series is classified for the filters. Plain
// JavaScript so that scripts/check-build.mjs uses the very same rules when it
// recomputes every facet count shown on the catalogue. Classification only:
// it reads ids, dims and names from series.json and never touches a value.

/** Facet groups in display order. `open`: expanded by default. */
export const FACETS = [
  { key: "dataset", label: "Data type", open: true },
  { key: "topic", label: "Topic", open: true, more: 6 },
  { key: "geo", label: "Geography", open: true },
  { key: "definition", label: "Definition (labour force)", open: true },
  { key: "side", label: "Budget side", open: false },
  { key: "sex", label: "Sex", open: false },
  { key: "area", label: "Area", open: false },
  { key: "measure", label: "Kind of CPI figure", open: false },
  { key: "base", label: "CPI base year", open: false },
  { key: "frequency", label: "Frequency", open: false },
  { key: "unit", label: "Unit", open: false },
];

const GEO = { pk: "Pakistan", "pk-pb": "Punjab", "pk-sd": "Sindh", "pk-kp": "Khyber Pakhtunkhwa", "pk-ba": "Balochistan" };
const SEX = { total: "Both sexes", male: "Male", female: "Female" };
const AREA = { national: "National", total: "Total", urban: "Urban", rural: "Rural", "none stated": "Not stated in the document" };
const MEASURE = { index: "Index level", yoy: "Change over a year", mom: "Change over a month", weight: "Weight in the basket" };
const FREQ = { fiscal_year: "Fiscal year", month: "Month (June issues)", survey_round: "Survey round", year: "Calendar year", quarter: "Quarter" };
const UNIT = { PKR: "Rupees", percent: "Per cent", index: "Index", persons: "Persons" };

/** Topic key of a series, or null. ABS: the function; CPI: the group; LFS: the measure. */
export function topicKey(s) {
  if (s.dataset === "abs") return s.dims?.function ? `abs:${s.dims.function.toLowerCase()}` : null;
  if (s.dataset === "cpi") return s.dims?.group ? `cpi:${s.dims.group}` : null;
  if (s.dataset === "lfs") return `lfs:${s.series_id.split(".")[1] ?? "other"}`;
  return null;
}

function topicWords(s) {
  if (s.dataset === "abs") {
    const f = s.dims.function;
    return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  }
  if (s.dataset === "cpi") return (s.name.split(": ")[1] ?? s.name).split(",")[0].replace(/\s*\(.*$/, "").trim();
  if (s.dataset === "lfs") return s.name.split(/[,:]/)[0].replace(/\s*\(19th ICLS\)$/, "").trim();
  return s.name;
}

/** key -> label, taken from the first series (in the given order) with that key. */
const DATASET_TAG = { abs: "budget", cpi: "CPI", lfs: "labour force" };

export function topicLabels(series) {
  const out = new Map();
  for (const s of series) {
    const k = topicKey(s);
    if (k && !out.has(k)) out.set(k, topicWords(s));
  }
  // The same words in two data types ("Health" in the budget and in the CPI): say which.
  const seen = new Map();
  for (const v of out.values()) seen.set(v.toLowerCase(), (seen.get(v.toLowerCase()) ?? 0) + 1);
  for (const [k, v] of out) if (seen.get(v.toLowerCase()) > 1) out.set(k, `${v} (${DATASET_TAG[k.split(":")[0]] ?? k.split(":")[0]})`);
  return out;
}

/** Facet values of one series: { facetKey: valueKey | null }. */
export function facetValuesOf(s) {
  const d = s.dims ?? {};
  return {
    dataset: s.dataset,
    topic: topicKey(s),
    geo: s.geo ?? null,
    definition: d.definition ?? null,
    side: s.dataset === "abs" ? (d.side === "receipts" ? "receipts" : "expenditure") : null,
    sex: d.sex ?? null,
    area: d.area ?? d.area_as_printed ?? null,
    measure: s.dataset === "cpi" ? (d.measure ?? null) : null,
    base: s.dataset === "cpi" ? (d.base_year ?? null) : null,
    frequency: s.frequency ?? null,
    unit: s.unit ?? null,
  };
}

/** Words for a facet value. `topics` from topicLabels(), `datasets` maps key -> name. */
export function valueWords(facet, value, topics, datasets) {
  switch (facet) {
    case "dataset":
      return datasets?.[value] ?? value;
    case "topic":
      return topics?.get(value) ?? value;
    case "geo":
      return GEO[value] ?? value;
    case "sex":
      return SEX[value] ?? value;
    case "area":
      return AREA[value] ?? value;
    case "measure":
      return MEASURE[value] ?? value;
    case "frequency":
      return FREQ[value] ?? value;
    case "unit":
      return UNIT[value] ?? value;
    case "side":
      return value === "receipts" ? "Receipts" : "Expenditure";
    case "base":
      return value;
    default:
      return value;
  }
}

/** Every value of every facet with its series count, in a stable order. */
export function facetCounts(series) {
  const out = {};
  for (const f of FACETS) out[f.key] = new Map();
  for (const s of series) {
    const v = facetValuesOf(s);
    for (const f of FACETS) {
      const x = v[f.key];
      if (x === null || x === undefined) continue;
      out[f.key].set(x, (out[f.key].get(x) ?? 0) + 1);
    }
  }
  return out;
}
