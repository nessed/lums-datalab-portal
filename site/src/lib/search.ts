// Site search (DESIGN.md section 10). One index, one ranking, used by the
// header search, the results page (/search), the catalogue (/browse?q=) and
// Compare's "add a series". The index is written at build time by
// scripts/prebuild/search.mjs from the release (through the adapter) and
// editorial/concepts.json; scripts/checks/search-index.mjs checks every value
// in it against the release.
//
// No library: the matching is written here, small enough to read.
//   forgiveness  typos (edit distance), a light stemmer, word equivalences
//                ("women" = "female"), stopwords, years ("2023", "FY26",
//                "FY2025-26"), prefixes while typing;
//   inference    a province word becomes a visible, removable filter, and a
//                year becomes one too; never silently;
//   ranking      concept match, then the headline layer, then the reader name,
//                then the printed label, then document text.
//
// This file imports only ids.ts, so `node scripts/search-test.mjs` runs the
// same code over the same index as the browser does.
import { slugify } from "./ids.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Same rule as periodWords in format.ts: months in words, fiscal years and rounds as printed. */
export function periodText(period: string | undefined, frequency?: string): string {
  if (!period) return "";
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (frequency === "month" && m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return period;
}

export const receiptHref = (seriesId: string, period: string, vintage: string) => `/o/${slugify(`${seriesId}:${period}:${vintage}`)}`;
export const seriesHrefOf = (seriesId: string) => `/series/${slugify(seriesId)}`;

/* ---------- the index ---------- */

/** One checked figure of a concept's headline series, as stored: [period, vintage, short value, source marker, kind in words]. */
export type AnswerTuple = [string, string, string, string, string];

/** The same figure, ready to show. */
export type AnswerValue = {
  /** Period as stored ("2025-26", "2026-06") and in words ("June 2026"). */
  p: string;
  pw: string;
  /** Vintage code ("be", "re", "na"). */
  vt: string;
  /** The value in short scale ("Rs 37.4 billion", "4.1%"). */
  v: string;
  /** Source marker ("ABS 2026-27, p. 11"). */
  m: string;
  /** Kind of figure in words ("budget estimate", "change over a year"). */
  k: string;
  /** Receipt link. */
  o: string;
};

export type Answer = {
  /** Headline series id, plain title, printed name (as the release names it), unit in words, frequency. */
  s: string;
  n: string;
  pn?: string;
  u: string;
  f: string;
  /** Every checked, signed-off value of the series, oldest first. */
  vals: AnswerTuple[];
  /** Index into vals of the latest checked value (latest period, most final kind). */
  latest: number;
  /** One-sentence plain summary of the series (editorial, no digits). */
  sm?: string;
};

/**
 * One index row. A loose shape (every field optional except k, id, n, h) so
 * that older readers of the index (Compare) keep working.
 *   k: "s" series | "d" document | "t" table as printed | "c" concept | "m" meta
 */
export type SearchEntry = {
  k: "s" | "d" | "t" | "c" | "m";
  id: string;
  n: string;
  /** Link; rebuilt by the engine from the id (not stored in the file). */
  h: string;
  /** Series: data type name. Document and table: what it is ("Annual Budget Statement 2025-26, p. 9"). */
  d?: string;
  /** Unit in words. */
  u?: string;
  f?: string;
  /** Periods covered, in words ("2010-11 to 2026-27"); a document's period as stored. */
  p?: string;
  /** First and last period with a checked value, as stored. */
  fr?: string;
  to?: string;
  /** Checked values. */
  c?: number;
  /** Synonyms and search words (series), space separated. */
  y?: string;
  x?: number;
  /** Printed row label, when it differs from the title and the printed name. */
  l?: string;
  /** Series: the printed name, when it differs from the plain title in n. */
  pn?: string;
  /** Geography code ("pk", "pk-pb"). */
  g?: string;
  /** In the headline layer (signed off, chosen). */
  hl?: number;
  /** On an earlier base than the current one of its data type (CPI 2007-08 base). */
  ob?: number;
  /** Has figures after its latest checked one that are withheld (not checked), so it has not ended. */
  lw?: number;
  /** Not signed off (decision 17.1): never in the headline layer or an answer card. */
  cand?: number;
  /** Latest checked value: short form, kind in words, period and vintage as stored. */
  lv?: string;
  lk?: string;
  lpr?: string;
  lvt?: string;
  /** Rebuilt by the engine: the latest period in words and its receipt link. */
  lp?: string;
  lo?: string;
  /** Document type of a document or table ("abs"). */
  dt?: string;
  /** Concept: synonyms, series ids (headline first), topic, honest sentence, related series, document type, answer. */
  ys?: string[];
  s?: string[];
  t?: string;
  miss?: string;
  rel?: string[];
  doc?: string;
  a?: Answer;
  /** Meta: release id, word equivalences and data type names (a series' d is a position in ds; the engine puts the name back). */
  r?: string;
  w?: string[][];
  ds?: string[];
};

/* ---------- words ---------- */

const STOP = new Set(
  "a an the of on in for to and or by with from at as is are was were be been what whats which who how much many does do did show me give tell find about data figure figures number numbers statistic statistics stats pakistan pakistani pk rs rupee rupees please i we our my get latest".split(
    " ",
  ),
);
/** Words that narrow nothing in this release: matched if present, never required. */
const SOFT = new Set("federal government govt national total overall official public state country level".split(" "));

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A light English stemmer: plurals, -ing, -ed, -ment, final e. Same rule for the index and the query. */
export function stem(w: string): string {
  if (w.length <= 3 || /^\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (/(ss|us|is)$/.test(w)) {
    /* keep */
  } else if (/(xes|ches|shes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 6 && w.endsWith("ment")) w = w.slice(0, -4);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Words of a text, stopwords dropped, stemmed. */
export function terms(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/** Lower-cased words of a query (the catalogue's plain filter falls back to these). */
export function tokens(q: string): string[] {
  return norm(q).split(" ").filter(Boolean);
}

/** Optimal string alignment distance, stopping early once over `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/* ---------- inference: provinces and years ---------- */

export const PROVINCES: { code: string; label: string; words: string[] }[] = [
  { code: "pk-pb", label: "Punjab", words: ["punjab"] },
  { code: "pk-sd", label: "Sindh", words: ["sindh", "sind"] },
  { code: "pk-kp", label: "Khyber Pakhtunkhwa", words: ["khyber pakhtunkhwa", "khyber", "pakhtunkhwa", "kpk", "kp", "nwfp"] },
  { code: "pk-ba", label: "Balochistan", words: ["balochistan", "baluchistan"] },
];

export type YearAsk = {
  /** What the reader typed, for the chip ("2023", "FY26"). */
  said: string;
  /** Fiscal years and survey rounds it matches ("2022-23", "2023-24"). */
  fiscal: string[];
  /** Months it matches: a calendar year prefix ("2023-") or one month ("2023-06"). */
  months: string[];
};

const fy = (end: number) => `${end - 1}-${String(end % 100).padStart(2, "0")}`;

/** Finds years in a query and returns the query without them. */
export function readYears(raw: string): { rest: string; years: YearAsk[] } {
  const years: YearAsk[] = [];
  let rest = ` ${raw.toLowerCase()} `;
  const take = (re: RegExp, fn: (m: string[]) => YearAsk | null) => {
    rest = rest.replace(re, (...args: unknown[]) => {
      const m = args.filter((a) => typeof a === "string" || a === undefined).slice(0, 3) as string[];
      const y = fn(m);
      if (!y) return m[0];
      years.push(y);
      return " ";
    });
  };
  // FY2025-26, 2025-26, 2025/26, 2025-2026, and a month 2026-06.
  take(/(?<![\w-])(?:fy\s?)?((?:19|20)\d{2})\s?[-/–]\s?(\d{4}|\d{2})(?![\w-])/g, (m) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const two = m[2].length === 4 ? b % 100 : b;
    if ((a + 1) % 100 === two && (m[2].length === 2 || b === a + 1)) return { said: m[0].trim(), fiscal: [fy(a + 1)], months: [] };
    if (m[2].length === 2 && b >= 1 && b <= 12 && !/fy/.test(m[0])) return { said: m[0].trim(), fiscal: [], months: [`${a}-${m[2]}`] };
    return null;
  });
  // FY2026, FY 26, fy26: the fiscal year ending then.
  take(/(?<![\w-])fy\s?((?:19|20)\d{2}|\d{2})(?![\w-])/g, (m) => {
    const end = m[1].length === 4 ? Number(m[1]) : 2000 + Number(m[1]);
    return { said: m[0].trim(), fiscal: [fy(end)], months: [] };
  });
  // 2023: both fiscal years it touches, and its months.
  take(/(?<![\w-])((?:19|20)\d{2})(?![\w-])/g, (m) => {
    const y = Number(m[1]);
    return { said: m[0].trim(), fiscal: [fy(y), fy(y + 1)], months: [`${y}-`] };
  });
  return { rest: rest.trim(), years };
}

function readProvince(text: string): { rest: string; code: string | null; label: string | null; said: string | null } {
  const t = ` ${norm(text)} `;
  for (const p of PROVINCES) {
    for (const w of p.words) {
      if (t.includes(` ${w} `)) return { rest: t.replace(` ${w} `, " ").trim(), code: p.code, label: p.label, said: w };
    }
  }
  return { rest: text, code: null, label: null, said: null };
}

/* ---------- the engine ---------- */

type Field = { w: number; t: string[] };
type Prepared = { e: SearchEntry; f: Field[]; lenPenalty: number };
type ConceptPrep = { e: SearchEntry; phrases: string[][] };

export type Engine = {
  release: string | null;
  series: Prepared[];
  docs: Prepared[];
  tables: Prepared[];
  concepts: ConceptPrep[];
  conceptById: Map<string, SearchEntry>;
  seriesById: Map<string, SearchEntry>;
  /** Stem -> the first surface word seen for it (for "Did you mean"). */
  vocab: Map<string, string>;
  /** Stem -> equivalent stems. */
  equiv: Map<string, Set<string>>;
  /** Data type name (d) -> the latest period with a checked value in any of its series. */
  latestOf: Map<string, string>;
};

// Field weights: the ranking tiers below the concept and headline layers.
const W_NAME = 10;
const W_SYN = 8;
const W_LABEL = 6;
/** The printed name of a series, when its plain title differs: below the title, level with synonyms. */
const W_PRINTED = 8;
const W_DOC = 1.5;

export function buildEngine(index: SearchEntry[]): Engine {
  const vocab = new Map<string, string>();
  const addVocab = (text: string) => {
    for (const w of norm(text).split(" ")) {
      if (!w || STOP.has(w)) continue;
      const s = stem(w);
      if (!vocab.has(s)) vocab.set(s, w);
    }
  };
  const prep = (e: SearchEntry, fields: [number, string | undefined][]): Prepared => {
    const f: Field[] = [];
    for (const [w, text] of fields) {
      if (!text) continue;
      addVocab(text);
      f.push({ w, t: terms(text) });
    }
    return { e, f, lenPenalty: Math.min(2, e.n.length / 80) };
  };
  const eng: Engine = {
    release: null,
    series: [],
    docs: [],
    tables: [],
    concepts: [],
    conceptById: new Map(),
    seriesById: new Map(),
    vocab,
    equiv: new Map(),
    latestOf: new Map(),
  };
  const dsNames = index.find((e) => e.k === "m")?.ds ?? [];
  for (const e of index) {
    // Links and words the file leaves out, rebuilt here.
    if (e.k === "s") {
      e.h = seriesHrefOf(e.id);
      if (typeof (e.d as unknown) === "number") e.d = dsNames[e.d as unknown as number];
      // The header index carries first and last period; the compare index carries the words already (p).
      if (e.fr && e.to) e.p = `${periodText(e.fr, e.f)} to ${periodText(e.to, e.f)}`;
      else e.p ??= "";
      if (e.lpr && e.lvt) {
        e.lp = periodText(e.lpr, e.f);
        e.lo = receiptHref(e.id, e.lpr, e.lvt);
      }
    } else if (e.k === "d") e.h = `/sources/${slugify(e.id)}`;
    else if (e.k === "t") e.h = `/tables/${e.id}`;
    else if (e.k === "c") e.h = `/search?q=${encodeURIComponent(e.ys?.[0] ?? e.n)}`;
    if (e.k === "m") {
      eng.release = e.r ?? null;
      for (const group of e.w ?? []) {
        const stems = group.map((g) => stem(norm(g)));
        for (const g of group) addVocab(g);
        for (const s of stems) {
          const set = eng.equiv.get(s) ?? new Set<string>();
          for (const o of stems) if (o !== s) set.add(o);
          eng.equiv.set(s, set);
        }
      }
    } else if (e.k === "s") {
      eng.seriesById.set(e.id, e);
      if (e.d && e.to && e.to > (eng.latestOf.get(e.d) ?? "")) eng.latestOf.set(e.d, e.to);
      eng.series.push(
        prep(e, [
          [W_NAME, e.n],
          [W_SYN, e.y],
          [W_PRINTED, e.pn],
          [W_LABEL, e.l],
          [W_DOC, `${e.d ?? ""} ${e.u ?? ""} ${e.id.replace(/[._]/g, " ")}`],
        ]),
      );
    } else if (e.k === "d")
      eng.docs.push(
        prep(e, [
          [W_NAME, e.n],
          [W_DOC, `${e.d ?? ""} ${e.id.replace(/[-_]/g, " ")}`],
        ]),
      );
    else if (e.k === "t")
      eng.tables.push(
        prep(e, [
          [W_NAME, e.n],
          [W_DOC, e.d],
        ]),
      );
    else if (e.k === "c") {
      eng.conceptById.set(e.id, e);
      const phrases = [e.n, ...(e.ys ?? [])].map((p) => {
        addVocab(p);
        return terms(p);
      });
      eng.concepts.push({ e, phrases: phrases.filter((p) => p.length) });
    }
  }
  return eng;
}

/** How each query word may match: stem -> weight (1 exact, less for an equivalent, a prefix or a typo). */
type Expansion = Map<string, number>;

function expand(eng: Engine, word: string, typing: boolean): Expansion {
  const out: Expansion = new Map();
  const put = (t: string, w: number) => {
    if ((out.get(t) ?? 0) < w) out.set(t, w);
  };
  const s = stem(word);
  put(s, 1);
  for (const o of eng.equiv.get(s) ?? []) put(o, 0.85);
  const known = eng.vocab.has(s);
  // Prefixes: the word being typed, or a word we do not know.
  if ((typing || !known) && word.length >= 2 && !/^\d+$/.test(word)) {
    const head = word.length > 3 ? s : word;
    let n = 0;
    for (const v of eng.vocab.keys()) {
      if (v !== s && v.startsWith(head)) {
        put(v, typing ? 0.75 : 0.6);
        for (const o of eng.equiv.get(v) ?? []) put(o, 0.55);
        if (++n > 40) break;
      }
    }
  }
  // Typos: only for a word we do not know. One edit from four letters, two from eight.
  if (!known && word.length >= 4 && !/\d/.test(word)) {
    const max = word.length >= 8 ? 2 : 1;
    for (const [v, surface] of eng.vocab) {
      // Against the stem, and against the word as written ("spendng" is one edit from "spending", two from "spend").
      const ds = Math.abs(v.length - s.length) > max ? max + 1 : editDistance(s, v, max);
      const dw = Math.abs(surface.length - word.length) > max ? max + 1 : editDistance(word, surface, max);
      const d = Math.min(ds, dw);
      if (d <= max) {
        put(v, d === 1 ? 0.7 : 0.5);
        for (const o of eng.equiv.get(v) ?? []) put(o, d === 1 ? 0.6 : 0.42);
      }
    }
  }
  return out;
}

export type Chip = { kind: "province" | "year"; label: string; said: string };

/** t: 1 when the series is dated (earlier base, or figures that stopped years ago) and ranks below current ones. */
export type Hit = { e: SearchEntry; score: number; t?: number };

export type SearchResult = {
  q: string;
  /** The words searched for, after stopwords and inferred filters. */
  words: string[];
  concept: SearchEntry | null;
  /** Other concepts the query touches, for "related topics". */
  related: SearchEntry[];
  series: Hit[];
  docs: Hit[];
  tables: Hit[];
  chips: Chip[];
  /** Years asked for (only while inference is on). */
  years: YearAsk[];
  /** Province filter in force. */
  province: string | null;
  /** True when no result matched every word and the list shows near matches. */
  partial: boolean;
  /** A corrected query when a word matched nothing ("inflaton" -> "inflation"). */
  suggestion: string | null;
  /** Milliseconds spent. */
  ms: number;
};

export type SearchOptions = {
  /** false: search everything, no inferred filters ("search everything instead"). */
  infer?: boolean;
  /** Treat the last word as still being typed (prefix match). */
  typing?: boolean;
  limit?: number;
};

function inRange(e: SearchEntry, ys: YearAsk[]): boolean {
  if (!ys.length) return true;
  const fr = e.fr;
  const to = e.to;
  if (!fr || !to) return false;
  return ys.some(
    (y) =>
      y.fiscal.some((p) => e.f !== "month" && p >= fr && p <= to) ||
      y.months.some((m) => e.f === "month" && (m.length === 5 ? `${m}12` >= fr && `${m}01` <= to : m >= fr && m <= to)),
  );
}

function periodMatches(period: string | undefined, ys: YearAsk[]): boolean {
  if (!period) return false;
  return ys.some((y) => y.fiscal.includes(period) || y.months.some((m) => period.startsWith(m)));
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** The query, run over the index. Pure: the same input gives the same output everywhere. */
export function runSearch(eng: Engine, raw: string, opt: SearchOptions = {}): SearchResult {
  const t0 = now();
  const infer = opt.infer !== false;
  const typing = opt.typing === true && !/\s$/.test(raw);
  const { rest: noYears, years } = readYears(raw);
  const prov = infer ? readProvince(noYears) : { rest: noYears, code: null, label: null, said: null };
  const activeYears = infer ? years : [];
  const chips: Chip[] = [];
  if (prov.code) chips.push({ kind: "province", label: `Province: ${prov.label}`, said: prov.said ?? "" });
  for (const y of activeYears)
    chips.push({
      kind: "year",
      label: `Figures for ${y.fiscal.length ? y.fiscal.join(" or ") : y.months.map((m) => (m.length === 5 ? `months of ${m.slice(0, 4)}` : m)).join(", ")}`,
      said: y.said,
    });

  // Query words: all of them for concepts (a province word can name a concept), the rest for entries.
  const toWords = (s: string) =>
    norm(s)
      .split(" ")
      .filter((w) => w && !STOP.has(w));
  const conceptWords = toWords(noYears);
  const words = toWords(prov.rest);
  const expCache = new Map<string, Expansion>();
  const exp = (w: string, isLast: boolean) => {
    const key = `${w}|${isLast}`;
    let x = expCache.get(key);
    if (!x) {
      x = expand(eng, w, isLast);
      expCache.set(key, x);
    }
    return x;
  };
  const qx = words.map((w, i) => ({ w, soft: SOFT.has(w), x: exp(w, typing && i === words.length - 1) }));
  const cx = conceptWords.map((w, i) => ({ w, soft: SOFT.has(w), x: exp(w, typing && i === conceptWords.length - 1) }));

  // Spelling: a word that matches nothing gets the nearest known word, within one edit per three letters
  // (at most three), measured against the stem and against the word as written; a known word the typed one
  // merely extends ("year" in "yearly") is a different word, not a typo, and ties go to the longer shared
  // start. It used to allow three edits against the stem at any length, so "zakat" was offered "abatement"
  // (two edits from its stem "abat"), "yearly" was offered "year" and "unemploymnt" "employment".
  let suggestion: string | null = null;
  const lead = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i;
  };
  const fixes = conceptWords.map((w) => {
    if (w.length < 4 || /\d/.test(w) || eng.vocab.has(stem(w)) || exp(w, false).size > 1) return w;
    const max = Math.min(3, Math.max(1, Math.floor(w.length / 3)));
    const sw = stem(w);
    let best: string | null = null;
    let bd = max + 1;
    let bl = -1;
    for (const [v, surface] of eng.vocab) {
      if (w.startsWith(surface)) continue;
      const d = Math.min(editDistance(sw, v, max), editDistance(w, surface, max));
      const l = lead(w, surface);
      if (d < bd || (d === bd && d <= max && l > bl)) {
        bd = d;
        bl = l;
        best = surface;
      }
    }
    return best ?? w;
  });
  if (fixes.some((f, i) => f !== conceptWords[i])) suggestion = fixes.join(" ");
  else if (/\d/.test(raw) === false) {
    // Words each known, but typed with typos the expansion already forgave: suggest the word it matched.
    const fixed = conceptWords.map((w) => {
      if (eng.vocab.has(stem(w))) return w;
      let best = w;
      let bw = 0;
      for (const [t, wt] of exp(w, false)) if (wt > bw && wt < 1 && eng.vocab.has(t)) [best, bw] = [eng.vocab.get(t) ?? w, wt];
      return best;
    });
    if (fixed.some((f, i) => f !== conceptWords[i]) && !typing) suggestion = fixed.join(" ");
  }

  /* concepts */
  type Q = { w: string; soft: boolean; x: Expansion };
  const matchConcepts = (qs: Q[]) => {
    const out: { e: SearchEntry; s: number }[] = [];
    if (!qs.some((q) => !q.soft)) return out;
    for (const c of eng.concepts) {
      let best = 0;
      for (const ph of c.phrases) {
        const set = new Set(ph);
        let got = 0;
        let all = true;
        for (const q of qs) {
          let m = 0;
          for (const [t, w] of q.x) if (set.has(t) && w > m) m = w;
          if (m === 0 && !q.soft) all = false;
          got += m;
        }
        if (!all) continue;
        const covered = ph.filter((t) => qs.some((q) => q.x.has(t))).length / ph.length;
        const s = (got / qs.length) * 0.7 + covered * 0.3;
        if (s > best) best = s;
      }
      if (best > 0) out.push({ e: c.e, s: best });
    }
    return out;
  };
  let scored = matchConcepts(cx);
  // "wages punjab": no concept names Punjab, so try again without the province word.
  if (!scored.length && prov.code) scored = matchConcepts(qx);
  scored.sort((a, b) => b.s - a.s || (a.e.miss ? 1 : 0) - (b.e.miss ? 1 : 0));
  let concept = scored[0] && scored[0].s >= 0.55 ? scored[0].e : null;
  // A province name alone is a filter, not a question.
  if (prov.code && !qx.some((q) => !q.soft)) concept = null;
  // A concept about the whole country is not the answer to a province question.
  if (concept && prov.code && concept.s?.length && !concept.s.some((id) => eng.seriesById.get(id)?.g === prov.code)) concept = null;
  const related = scored
    .filter((x) => x.e !== concept && x.s >= 0.35)
    .slice(0, 6)
    .map((x) => x.e);

  /* entries */
  const boost = new Map<string, number>();
  if (concept) {
    (concept.s ?? []).forEach((id, i) => boost.set(id, 1000 - i * 10));
    (concept.rel ?? []).forEach((id, i) => boost.set(id, Math.max(boost.get(id) ?? 0, 600 - i * 10)));
  }
  for (const r of related.slice(0, 3)) (r.s ?? []).forEach((id, i) => boost.set(id, Math.max(boost.get(id) ?? 0, 300 - i * 10)));
  const hardCount = qx.filter((q) => !q.soft).length;
  const filterOnly = qx.length === 0 && (!!prov.code || activeYears.length > 0);

  const scoreOne = (p: Prepared): { s: number; cov: number } => {
    let s = 0;
    let hit = 0;
    for (const q of qx) {
      let m = 0;
      for (const f of p.f) {
        for (const t of f.t) {
          const w = q.x.get(t);
          if (w !== undefined && w * f.w > m) m = w * f.w;
        }
      }
      if (m > 0) {
        s += m;
        if (!q.soft) hit++;
      }
    }
    return { s, cov: hardCount ? hit / hardCount : s > 0 ? 1 : 0 };
  };

  const rank = (list: Prepared[], kind: "s" | "d" | "t") => {
    const full: Hit[] = [];
    const part: Hit[] = [];
    for (const p of list) {
      const e = p.e;
      if (kind === "s" && prov.code && e.g !== prov.code) continue;
      if (kind === "s" && !inRange(e, activeYears)) continue;
      if (kind !== "s" && filterOnly) continue;
      const b = kind === "s" ? (boost.get(e.id) ?? 0) : 0;
      const { s, cov } = qx.length ? scoreOne(p) : { s: 0, cov: filterOnly ? 1 : 0 };
      if (s === 0 && b === 0 && !filterOnly) continue;
      let score = s + b;
      if (kind === "s") {
        if (cov === 1 && e.hl && !e.cand) score += 100;
        if ((e.c ?? 0) === 0) score -= 20;
        if (e.x) score -= 2;
      } else {
        if (concept?.doc && e.dt === concept.doc) score += 50;
        if (activeYears.length && periodMatches(e.p, activeYears)) score += 30;
      }
      score -= p.lenPenalty;
      // Current series first: one on an earlier base, or whose checked figures stopped years before its data
      // type's latest, ranks below every current one (DESIGN.md 10.7; round 2 item 14). The concept's own
      // headline series is the exception: it is the answer the card shows.
      const t = kind === "s" && b < 1000 && datedOf(eng, e) ? 1 : 0;
      if (cov === 1 || b > 0) full.push({ e, score, t });
      else if (cov >= 0.5) part.push({ e, score, t });
    }
    const order = (a: Hit, b: Hit) => (a.t ?? 0) - (b.t ?? 0) || b.score - a.score;
    full.sort(order);
    part.sort(order);
    return { full, part };
  };
  const rs = rank(eng.series, "s");
  const rd = rank(eng.docs, "d");
  const rt = rank(eng.tables, "t");
  const partial = rs.full.length + rd.full.length + rt.full.length === 0 && rs.part.length + rd.part.length + rt.part.length > 0;
  const pick = (r: { full: Hit[]; part: Hit[] }) => (partial ? r.part : r.full).slice(0, opt.limit ?? 500);
  return {
    q: raw,
    words,
    concept,
    related,
    series: pick(rs),
    docs: pick(rd),
    tables: pick(rt),
    chips,
    years: activeYears,
    province: prov.code,
    partial,
    suggestion,
    ms: now() - t0,
  };
}

/* ---------- current or dated ---------- */

const yearOf = (p: string | undefined) => (p ? Number(p.slice(0, 4)) : NaN);

export type Dated = {
  /** The last period with a checked value, in words, when it is two years or more before its data type's latest. */
  ended: string | null;
  /** True when later figures exist but are withheld: "checked to", not "ends". */
  withheld: boolean;
  /** On an earlier base than the current one. */
  earlier: boolean;
};

/** Null for a current series; otherwise why it is not current. */
export function datedOf(eng: Engine, e: SearchEntry): Dated | null {
  if (e.k !== "s") return null;
  const latest = e.d ? eng.latestOf.get(e.d) : undefined;
  const ended = e.to && latest && yearOf(latest) - yearOf(e.to) >= 2 ? periodText(e.to, e.f) : null;
  const earlier = e.ob === 1;
  return ended || earlier ? { ended, withheld: e.lw === 1, earlier } : null;
}

/* ---------- filters (facets) and families ---------- */

/**
 * The filters a series can be narrowed by, read from its id. Series ids are
 * built from the release's dimensions (cpi.<area>.<measure>.<group>,
 * lfs.<measure>.[<province>.]<sex>.<area>, fed.<side>...); scripts/search-test.mjs
 * checks, for every series, that what is read here equals the release's own
 * dims, unit and geography, so the two cannot drift apart.
 *   topic    data type: "cpi" prices, "lfs" labour force, "abs" federal budget
 *   area     "all" (national, or urban and rural together), "urban", "rural", "none" (no area printed)
 *   measure  CPI: "yoy", "mom", "index", "weight"; labour force: "rate", "count"
 *   sex      labour force: "total", "female", "male"
 *   prov     geography: "pk" or a province code
 */
export type Facets = { topic: string; area: string | null; measure: string | null; sex: string | null; prov: string };

export function facetsOf(e: SearchEntry): Facets {
  const p = e.id.split(".");
  const prov = e.g ?? "pk";
  if (p[0] === "cpi") {
    const area = ["national", "urban", "rural"].includes(p[1]) ? (p[1] === "national" ? "all" : p[1]) : "none";
    const measure = p.includes("yoy") ? "yoy" : p.includes("mom") ? "mom" : p.includes("weight") ? "weight" : "index";
    return { topic: "cpi", area, measure, sex: null, prov };
  }
  if (p[0] === "lfs") {
    const i = p.findIndex((x, j) => j > 1 && (x === "total" || x === "male" || x === "female"));
    const sex = i > 0 ? p[i] : null;
    const a = i > 0 ? p[i + 1] : undefined;
    const area = a === "urban" || a === "rural" ? a : a === "total" ? "all" : null;
    const measure = /rate|lfpr|share/.test(p[1] ?? "") ? "rate" : "count";
    return { topic: "lfs", area, measure, sex, prov };
  }
  return { topic: p[0] === "fed" ? "abs" : p[0], area: null, measure: null, sex: null, prov };
}

export const FACET_KEYS = ["topic", "area", "measure", "sex", "prov"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export const FACET_LABEL: Record<FacetKey, string> = { topic: "Topic", area: "Area", measure: "Kind of figure", sex: "Women and men", prov: "Province" };

const FACET_WORDS: Record<FacetKey, Record<string, string>> = {
  topic: { cpi: "Prices", lfs: "Jobs and labour", abs: "Federal budget" },
  area: { all: "All Pakistan", urban: "Urban", rural: "Rural", none: "Area not given" },
  measure: { yoy: "Change over a year", mom: "Change over a month", index: "Index level", weight: "Basket weight", rate: "Rate", count: "Number of people" },
  sex: { total: "Women and men", female: "Women", male: "Men" },
  prov: { pk: "Pakistan", ...Object.fromEntries(PROVINCES.map((x) => [x.code, x.label])) },
};

export const facetWords = (k: FacetKey, v: string) => FACET_WORDS[k][v] ?? v;

export type FacetPick = Partial<Record<FacetKey, string>>;

/** Hits that pass every chosen filter (except `skip`, for counting that filter's own choices). */
export function applyFacets(hits: Hit[], pick: FacetPick, skip?: FacetKey): Hit[] {
  const keys = FACET_KEYS.filter((k) => k !== skip && pick[k]);
  if (!keys.length) return hits;
  return hits.filter((h) => {
    const f = facetsOf(h.e);
    return keys.every((k) => f[k] === pick[k]);
  });
}

/** Each filter's choices among the hits (given the other chosen filters), with counts. Only filters with two or more choices, or a chosen one. */
export function facetChoices(hits: Hit[], pick: FacetPick): { key: FacetKey; values: { v: string; n: number }[] }[] {
  const out: { key: FacetKey; values: { v: string; n: number }[] }[] = [];
  for (const k of FACET_KEYS) {
    const m = new Map<string, number>();
    for (const h of applyFacets(hits, pick, k)) {
      const v = facetsOf(h.e)[k];
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    const order = Object.keys(FACET_WORDS[k]);
    const rank = (v: string) => (order.includes(v) ? order.indexOf(v) : 99);
    const values = [...m.entries()].map(([v, n]) => ({ v, n })).sort((a, b) => rank(a.v) - rank(b.v));
    if (values.length >= 2 || pick[k]) out.push({ key: k, values });
  }
  return out;
}

/** The family a series result is grouped under on the results page: plain words, no numbers. */
const DATED_FAMILY = { key: "z-dated", label: "Earlier base or older figures" };

export function familyOf(e: SearchEntry): { key: string; label: string } {
  const f = facetsOf(e);
  const p = e.id.split(".");
  if (f.topic === "cpi") {
    if (f.measure === "weight") return { key: "cpi-weight", label: "Weights in the price basket" };
    if (p.includes("general")) return f.area === "all" ? { key: "cpi-all", label: "Prices, all of Pakistan" } : { key: "cpi-ur", label: "Prices, urban and rural" };
    return { key: "cpi-group", label: "Prices by group of goods" };
  }
  if (f.topic === "lfs") {
    if (p.includes("icls19")) return { key: "lfs-icls19", label: "Labour force, new definition" };
    if (f.prov !== "pk") return { key: "lfs-prov", label: "Labour force by province" };
    if (f.area === "urban" || f.area === "rural") return { key: "lfs-ur", label: "Labour force, urban and rural" };
    return { key: "lfs-all", label: "Labour force, all of Pakistan" };
  }
  if (f.topic === "abs") {
    if (p[1] === "rev") return { key: "abs-rev", label: "Budget: money coming in" };
    const fn = p.indexOf("function");
    if (fn < 0) return { key: "abs-tot", label: "Budget: spending totals" };
    return p.length - fn > 2 ? { key: "abs-sub", label: "Budget: spending in detail" } : { key: "abs-fn", label: "Budget: spending by purpose" };
  }
  return { key: f.topic, label: e.d ?? "Other series" };
}

export type Family = { key: string; label: string; hits: Hit[] };

/** Series hits in families, each family in the order of its best hit; the dated family last. */
export function families(hits: Hit[]): Family[] {
  const by = new Map<string, Family>();
  for (const h of hits) {
    const f = h.t ? DATED_FAMILY : familyOf(h.e);
    let g = by.get(f.key);
    if (!g) {
      g = { key: f.key, label: f.label, hits: [] };
      by.set(f.key, g);
    }
    g.hits.push(h);
  }
  const dated = (g: Family) => (g.key === "z-dated" ? 1 : 0);
  return [...by.values()].sort((a, b) => dated(a) - dated(b));
}

/* ---------- sparklines (spark.json, fetched after the results show) ---------- */

/** [span, step, ...segments]; a segment is [x, value, value, ...] (values as stored, checked figures only). */
export type SparkRow = (number | (number | string)[])[];
export type Sparks = { r: string; s: Record<string, SparkRow> };

let sparkLoading: Promise<Sparks> | null = null;
let sparkLoaded: Sparks | null = null;
export function loadSparks(url: string): Promise<Sparks> {
  sparkLoading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sparklines: ${r.status}`))))
    .then((j: Sparks) => (sparkLoaded = j))
    .catch((e) => {
      sparkLoading = null;
      throw e;
    });
  return sparkLoading;
}
export const sparksIfLoaded = () => sparkLoaded;

/**
 * SVG geometry of one sparkline: the latest segment of two or more values (segments are never joined across a
 * gap or a break), scaled to the full width, so a figure cut off by a gap is never drawn as a stray dot beside the
 * line (the same rule as components/Spark.tsx). The series page's chart shows every figure. `dots` stays for
 * callers and is always empty.
 */
export function sparkPath(row: SparkRow, w: number, h: number): { d: string; dots: [number, number][]; last: [number, number] | null } {
  const step = Number(row[1]) || 1;
  const segs = (row.slice(2) as (number | string)[][]).filter((s) => s.length > 2);
  const seg = segs[segs.length - 1];
  if (!seg) return { d: "", dots: [], last: null };
  const vals = seg.slice(1).map(Number);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = (vals.length - 1) * step || 1;
  const px = (i: number) => 2 + ((i * step) / span) * (w - 6);
  const py = (y: number) => h - 3 - ((y - lo) / (hi - lo || 1)) * (h - 6);
  let d = "";
  let last: [number, number] | null = null;
  vals.forEach((v, i) => {
    last = [px(i), py(v)];
    d += `${i ? "L" : "M"}${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  });
  return { d, dots: [], last };
}

const valueOf = (a: Answer, t: AnswerTuple): AnswerValue => ({ p: t[0], pw: periodText(t[0], a.f), vt: t[1], v: t[2], m: t[3], k: t[4], o: receiptHref(a.s, t[0], t[1]) });

/** Answer values to show: those of the years asked for, else the latest. */
export function answerValues(a: Answer, years: YearAsk[]): { vals: AnswerValue[]; forYears: boolean } {
  if (years.length) {
    const vals = a.vals.filter((v) => periodMatches(v[0], years));
    if (vals.length) return { vals: vals.map((v) => valueOf(a, v)), forYears: true };
  }
  return { vals: a.vals[a.latest] ? [valueOf(a, a.vals[a.latest])] : [], forYears: false };
}

/* ---------- loading (browser) ---------- */

let loading: Promise<Engine> | null = null;
let loaded: Engine | null = null;

/** Fetches the index once (on first focus) and prepares it. */
export function loadEngine(url: string): Promise<Engine> {
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`search index: ${r.status}`))))
    .then((j: SearchEntry[]) => (loaded = buildEngine(j)))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

export const engineIfLoaded = () => loaded;

/* ---------- the old entry point, used by Compare ---------- */

const engines = new WeakMap<SearchEntry[], Engine>();

/** Series and documents for a query, best first. Same ranking as the header search. */
export function search(index: SearchEntry[], q: string, limit = 30): SearchEntry[] {
  let eng = engines.get(index);
  if (!eng) {
    eng = buildEngine(index);
    engines.set(index, eng);
  }
  const r = runSearch(eng, q, { typing: true, limit });
  return [...r.series, ...r.docs].slice(0, limit).map((h) => h.e);
}
