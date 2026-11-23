// Plain words on the first layer (data hub plan, section 4). The words a visitor
// does not know (BE, RE, "as printed", core, corroboration, cross-source,
// candidate, "revenue account", "survey round", "series break", "not in
// release", any snake_case or dotted id, any verification status code) may not
// appear in the visible text of the first-layer pages: the header, the home page,
// the Library index, the datasets index, the Indicators index, the guides index,
// the inflation calculator and Compare provinces. They may appear
// one click down: inside a closed <details>, or in an element marked
// data-layer="2". The editorial files of the run (library.json, stories.json)
// must be marked provisional and hold no digits.
import fs from "node:fs";
import path from "node:path";

const PAGES = [
  ["/", "index.html"],
  ["/library", "library.html"],
  ["/library/datasets", path.join("library", "datasets.html")],
  ["/topics", "topics.html"],
  ["/guides", "guides.html"],
  ["/inflation-calculator", "inflation-calculator.html"],
  ["/compare/education", path.join("compare", "education.html")],
];

const BANNED = [
  ["BE", /\bBE\b/],
  ["RE", /\bRE\b/],
  ["as printed", /\bas printed\b/i],
  ["core", /\bcore\b/i],
  ["corroboration", /\bcorroborat/i],
  ["cross-source", /\bcross-source\b/i],
  ["candidate", /\bcandidates?\b/i],
  ["revenue account", /\brevenue account\b/i],
  ["survey round", /\bsurvey rounds?\b/i],
  ["series break", /\bseries breaks?\b/i],
  ["not in release", /\bnot in (?:this )?release\b/i],
  ["snake_case id", /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/],
  ["dotted id", /\b[a-z][a-z0-9_]*\.[a-z0-9_]+\.[a-z0-9_.]*[a-z0-9_]\b/],
];
// Web addresses and release version tags ("v0.0.1-prototype") are not ids.
const NOT_AN_ID = /\.(?:app|com|org|net|pk|io|gov\.pk|edu\.pk)\b|^v\d+\.\d+/;

/** Visible text of the first layer: no scripts, styles, closed <details>, data-layer="2" blocks or tags. */
export function firstLayerText(html) {
  let h = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ");
  // Closed <details> (no open attribute): only the summary is first layer.
  h = h.replace(/<details(?![^>]*\sopen)[^>]*>([\s\S]*?)<\/details>/g, (_, inner) => (/<summary[^>]*>([\s\S]*?)<\/summary>/.exec(inner)?.[1] ?? ""));
  // Elements marked as a second layer (balanced on the same tag name).
  for (;;) {
    const m = /<([a-z][a-z0-9]*)\b[^>]*\sdata-layer="2"[^>]*>/i.exec(h);
    if (!m) break;
    const tag = m[1];
    let depth = 1;
    const re = new RegExp(`<(/?)${tag}\b[^>]*>`, "gi");
    re.lastIndex = m.index + m[0].length;
    let end = h.length;
    let x;
    while ((x = re.exec(h))) {
      depth += x[1] ? -1 : 1;
      if (depth === 0) {
        end = x.index + x[0].length;
        break;
      }
    }
    h = h.slice(0, m.index) + " " + h.slice(end);
  }
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&rsquo;|&#39;/g, "'")
    .replace(/\s+/g, " ");
}

export default function check({ siteDir, appDir, problem }) {
  let pages = 0;
  for (const [route, file] of PAGES) {
    const p = path.join(appDir, file);
    if (!fs.existsSync(p)) {
      problem("plain-words", route, "first-layer page not built");
      continue;
    }
    pages++;
    const text = firstLayerText(fs.readFileSync(p, "utf8"));
    for (const [name, re] of BANNED) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
      for (const m of text.matchAll(g)) {
        if (name === "dotted id" && NOT_AN_ID.test(m[0])) continue;
        const at = m.index ?? 0;
        problem("plain-words", route, `"${name}" on a first layer: "…${text.slice(Math.max(0, at - 40), at + 40).trim()}…"`);
      }
    }
  }
  let files = 0;
  for (const name of ["library.json", "stories.json", "daily.json", "synonyms.json"]) {
    const p = path.join(siteDir, "editorial", name);
    if (!fs.existsSync(p)) {
      if (name === "library.json") problem("plain-words", `editorial/${name}`, "missing");
      continue;
    }
    files++;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j.provisional !== true) problem("plain-words", `editorial/${name}`, 'not marked "provisional": true');
    const walk = (v, key) => {
      if (typeof v === "string") {
        if (!["$comment", "series", "kind", "id", "slug", "pattern", "chart", "group", "of", "parts"].includes(key) && /\d/.test(v)) problem("plain-words", `editorial/${name}`, `text holds a digit: "${v.slice(0, 80)}"`);
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(j, "");
  }
  return `${pages} first-layer pages, ${files} editorial files`;
}
