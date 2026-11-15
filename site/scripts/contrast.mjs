// Contrast check over every colour pair the site uses (npm run test:contrast).
//   node scripts/contrast.mjs            check, exit 1 on any failure
//   node scripts/contrast.mjs --table    also print every pair with its ratio
// Reads the colour tokens from src/design/tokens.css (resolving var() chains and
// compositing translucent colours over their ground), then checks each listed
// pair against WCAG 2 contrast: 4.5:1 for text, 3:1 for graphics and control
// borders. Also checks the categorical chart palette: 3:1 on white, and
// colour-vision-deficiency separation of neighbouring lines (Machado 2009
// protan/deutan simulation, OKLab distance x100, the dataviz palette method).
// Add a pair here whenever a new text/ground or mark/ground combination appears.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(siteDir, "src/design/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const raw = Object.fromEntries([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

/** Resolve a token to {r,g,b,a} (0-255, alpha 0-1). Composites onto `ground` if translucent. */
function colour(name, seen = new Set()) {
  const v = raw[name];
  if (v === undefined) throw new Error(`unknown token ${name}`);
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) return colour(ref[1], seen);
  return parse(v, name);
}
function parse(v, name = v) {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[/,]\s*([\d.]+))?\s*\)$/.exec(v);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`token ${name} is not a plain colour: ${v}`);
}
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
function ratio(fgName, bgName, underName = "--card") {
  let bg = colour(bgName);
  if (bg.a < 1) bg = over(bg, colour(underName));
  let fg = colour(fgName);
  if (fg.a < 1) fg = over(fg, bg);
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;
// [foreground, background, minimum, where it is used]
const PAIRS = [
  // ---- body text and metadata on the page ground, cards and recessed panels
  ["--ink", "--page", TEXT, "body text on the page ground"],
  ["--ink", "--card", TEXT, "body text on cards and panels"],
  ["--ink-2", "--page", TEXT, "secondary text on the page ground"],
  ["--ink-2", "--card", TEXT, "secondary text on cards"],
  ["--ink-2", "--surface-2", TEXT, "secondary text in table headers and callouts"],
  ["--ink-3", "--page", TEXT, "metadata grey on the page ground"],
  ["--ink-3", "--card", TEXT, "metadata grey on cards"],
  ["--ink-3", "--surface-2", TEXT, "metadata grey on table headers, callouts"],
  ["--ink-3", "--select-wash", TEXT, "metadata grey in a hovered or selected row"],
  ["--h1", "--page", TEXT, "navy h1 on the page ground"],
  ["--h1", "--card", TEXT, "navy h1 on a card"],
  ["--num", "--card", TEXT, "navy headline number on a card"],
  ["--num", "--page", TEXT, "navy headline number on the page ground"],
  // ---- links and actions on light ground
  ["--link", "--page", TEXT, "link blue on the page ground"],
  ["--link", "--card", TEXT, "link blue on cards"],
  ["--link", "--surface-2", TEXT, "link blue on recessed panels"],
  ["--link", "--select-wash", TEXT, "link blue in a hovered row"],
  ["--link-hover", "--card", TEXT, "link hover (navy) on cards"],
  ["--link", "--fact-bg", TEXT, "a value link inside a fact pill"],
  ["--btn-ink", "--btn-bg", TEXT, "primary button text"],
  ["--btn-ink", "--btn-bg-hover", TEXT, "primary button text, hover"],
  ["--btn2-ink", "--btn2-bg", TEXT, "secondary (outlined) button text"],
  ["--btn2-border", "--card", GRAPHIC, "secondary button border on a card"],
  ["--btn2-border", "--page", GRAPHIC, "secondary button border on the page ground"],
  ["--rule-strong", "--card", GRAPHIC, "control borders (fields, chips, segments) on white"],
  ["--rule-strong", "--page", GRAPHIC, "control borders on the page ground"],
  ["--focus", "--page", GRAPHIC, "focus ring (LUMS blue) on the page ground"],
  ["--focus", "--card", GRAPHIC, "focus ring (LUMS blue) on cards"],
  ["--select-rule", "--card", GRAPHIC, "selected-row edge and search-field border"],
  // ---- chips, segmented tabs and tabs
  ["--chip-ink", "--chip-bg", TEXT, "inactive chip text"],
  ["--chip-ink", "--chip-hover-bg", TEXT, "inactive chip text, hover"],
  ["--chip-active-ink", "--chip-active-bg", TEXT, "active chip: white on navy"],
  ["--chip-active-edge", "--chip-active-bg", GRAPHIC, "active chip: gold edge on navy"],
  ["--chip-active-bg", "--card", GRAPHIC, "active chip fill (navy) against white: the state without gold"],
  ["--chip-active-bg", "--page", GRAPHIC, "active chip fill (navy) against the page ground"],
  ["--focus-on-dark", "--chip-active-bg", GRAPHIC, "gold focus ring on an active (navy) chip"],
  ["--tab-active-rule", "--card", GRAPHIC, "active tab underline (navy) on white"],
  ["--tab-active-rule", "--page", GRAPHIC, "active tab underline (navy) on the page ground"],
  // ---- gold, every use (never text on white)
  ["--header-rule", "--header-bg", GRAPHIC, "gold rule under the navy header"],
  ["--focus-on-dark", "--header-bg", GRAPHIC, "gold focus ring on the navy header"],
  ["--focus-on-dark", "--footer-bg", GRAPHIC, "gold focus ring on the navy footer"],
  ["--pill-ink", "--pill-bg", TEXT, "'See it on the printed page': navy text on gold"],
  ["--pill-ink", "--pill-bg-hover", TEXT, "the printed-page pill, hover"],
  ["--ink", "--answer-wash", TEXT, "ink on the gold-tinted answer highlight"],
  ["--link", "--answer-wash", TEXT, "a value link inside the answer highlight"],
  ["--num", "--answer-wash", TEXT, "navy figure inside the answer highlight"],
  ["--site-nav-active", "--header-bg", GRAPHIC, "active nav item: gold underline on navy"],
  // ---- header and footer
  ["--header-ink", "--header-bg", TEXT, "white on navy: wordmark, nav"],
  ["--header-ink-2", "--header-bg", TEXT, "light grey-blue on navy: nav, release tag"],
  ["--header-field-ink", "--header-field-bg", TEXT, "search field placeholder in the header"],
  ["--ink", "--header-field-bg", TEXT, "typed text in the header search field"],
  ["--header-ink-2", "--header-bg", GRAPHIC, "Menu button border on navy"],
  ["--footer-ink", "--footer-bg", TEXT, "white footer text and links"],
  ["--footer-ink-2", "--footer-bg", TEXT, "light-grey footer text"],
  ["--notice-ink", "--notice-bg", TEXT, "prototype notice"],
  ["--ink-2", "--notice-bg", TEXT, "prototype notice 'Hide' button"],
  ["--tip-ink", "--tip-bg", TEXT, "chart tooltip"],
  ["--tip-ink-2", "--tip-bg", TEXT, "chart tooltip metadata"],
  // ---- fact pills
  ["--fact-ink", "--fact-bg", TEXT, "fact pill value"],
  ["--fact-label", "--fact-bg", TEXT, "fact pill label"],
  // ---- evidence
  ["--evidence-box", "--card", GRAPHIC, "box around the printed cell on a white page image"],
  ["--ink", "--evidence-tint", TEXT, "printed text under the evidence tint", "--card"],
  // ---- status system: text on white and on its own wash, mark on white
  ["--st-checked", "--card", TEXT, "status 'checked' words on white"],
  ["--st-checked", "--st-checked-wash", TEXT, "status 'checked' on its wash"],
  ["--st-disputed", "--card", TEXT, "status 'disputed' words on white"],
  ["--st-disputed", "--st-disputed-wash", TEXT, "status 'disputed' on its wash"],
  ["--st-gap", "--card", TEXT, "gap words on white"],
  ["--st-gap", "--page", TEXT, "gap words on the page ground"],
  ["--st-gap", "--st-gap-wash", TEXT, "gap words on their wash"],
  ["--st-withheld", "--card", TEXT, "withheld words on white"],
  ["--st-withheld", "--st-withheld-wash", TEXT, "withheld words on their wash"],
  ["--st-unknown", "--card", TEXT, "unknown-status words on white"],
  ["--ink", "--st-disputed-wash", TEXT, "text in a disputed callout"],
  ["--ink", "--st-checked-wash", TEXT, "text in an ok callout"],
  // ---- charts (lines and marks: graphics; labels and ticks: text)
  ["--chart-be", "--chart-ground", GRAPHIC, "line 1 (LUMS blue) on white"],
  ["--chart-re", "--chart-ground", GRAPHIC, "line 2 (amber) on white"],
  ["--chart-actual", "--chart-ground", GRAPHIC, "actuals line on white"],
  ["--chart-prov", "--chart-ground", GRAPHIC, "provisional line on white"],
  ["--chart-other", "--chart-ground", GRAPHIC, "other line on white"],
  ["--chart-neutral", "--chart-ground", GRAPHIC, "neutral line on white"],
  ["--chart-be", "--page", GRAPHIC, "sparkline (LUMS blue) on the page ground"],
  ["--chart-label", "--chart-ground", TEXT, "end-of-line labels on white"],
  ["--chart-axis", "--chart-ground", GRAPHIC, "axis line on white"],
  ["--ink-3", "--chart-ground", TEXT, "axis tick labels on white"],
  ["--cat-a", "--chart-ground", GRAPHIC, "compare line A on white"],
  ["--cat-b", "--chart-ground", GRAPHIC, "compare line B on white"],
  ["--cat-c", "--chart-ground", GRAPHIC, "compare line C on white"],
  ["--cat-d", "--chart-ground", GRAPHIC, "compare line D on white"],
  ["--cat-e", "--chart-ground", GRAPHIC, "compare line E on white"],
  ["--cat-f", "--chart-ground", GRAPHIC, "compare line F on white"],
];
// Pairs whose foreground is not a single token.
raw["--site-nav-active"] = "var(--header-rule)";

let fails = 0;
const rows = [];
for (const [fg, bg, min, what, under] of PAIRS) {
  let r;
  try {
    r = ratio(fg, bg, under);
  } catch (e) {
    fails++;
    rows.push(["ERROR", fg, bg, "", what, e.message]);
    continue;
  }
  const ok = r + 1e-9 >= min;
  if (!ok) fails++;
  rows.push([ok ? "pass" : "FAIL", fg, bg, `${r.toFixed(2)}:1 (min ${min})`, what]);
}

// ---- gold must never be text on white: assert it fails, so nobody "fixes" this list by using it.
const goldOnWhite = ratio("--gold", "--card");
rows.push([goldOnWhite < TEXT ? "pass" : "FAIL", "--gold", "--card", `${goldOnWhite.toFixed(2)}:1`, "gold on white is below 4.5:1, so gold is never text on white (and never the only state cue)"]);

// ---- categorical palette: CVD separation of neighbours (OKLab x100, Machado 2009 severity 1)
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const toLin = (c) => [lin(c.r), lin(c.g), lin(c.b)];
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const sim = (rgb, M) => M.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
const dE = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CAT = ["--cat-a", "--cat-b", "--cat-c", "--cat-d", "--cat-e", "--cat-f"];
const NEIGHBOUR_CVD = 8; // target for neighbouring lines (each line also has its own dash and marker)
const ANY_CVD = 6; // floor for any two lines: legal only because every line has its own dash and marker
const NEIGHBOUR_NORMAL = 15;
for (let i = 0; i < CAT.length; i++) {
  for (let j = i + 1; j < CAT.length; j++) {
    const a = toLin(colour(CAT[i]));
    const b = toLin(colour(CAT[j]));
    const cvd = Math.min(...Object.values(MACHADO).map((M) => dE(oklab(sim(a, M)), oklab(sim(b, M)))));
    const normal = dE(oklab(a), oklab(b));
    const neighbours = j === i + 1;
    const ok = cvd >= (neighbours ? NEIGHBOUR_CVD : ANY_CVD) && (!neighbours || normal >= NEIGHBOUR_NORMAL);
    if (!ok) fails++;
    if (neighbours || !ok || process.argv.includes("--table"))
      rows.push([ok ? "pass" : "FAIL", CAT[i], CAT[j], `CVD dE ${cvd.toFixed(1)}, normal dE ${normal.toFixed(1)}`, neighbours ? "neighbouring compare lines" : "any two compare lines (floor; dashes and markers also differ)"]);
  }
}

const show = process.argv.includes("--table");
for (const r of rows) if (show || r[0] !== "pass") console.log(r.join("  "));
const n = rows.length;
console.log(`contrast: ${n - fails} of ${n} checks pass${fails ? `, ${fails} FAIL` : ""}`);
process.exit(fails ? 1 : 0);
