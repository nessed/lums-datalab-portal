// The editorial files (site/editorial/*.json, DESIGN.md 6.4, 9.1 to 9.4): drafted
// by people or agents, never generated at build. Each must be marked
// provisional until a person approves it, must hold no numbers (every number
// on the site comes from the release), and may name only series the release
// holds.
import fs from "node:fs";
import path from "node:path";

// Keys whose values are identifiers, not words a reader sees.
const ID_KEYS = new Set(["series", "headline", "id", "slug", "topic", "questions", "kind", "$comment"]);

export default function check({ siteDir, series, problem }) {
  const dir = path.join(siteDir, "editorial");
  const files = ["topics.json", "headline.json", "questions.json"];
  let ids = 0;
  let texts = 0;
  for (const name of files) {
    const p = path.join(dir, name);
    const where = `editorial/${name}`;
    if (!fs.existsSync(p)) {
      problem("editorial", where, "missing");
      continue;
    }
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j.provisional !== true) problem("editorial", where, `not marked "provisional": true`);
    // A string is an identifier when the key holding it (or the array holding it) is an id key.
    const walk = (v, key) => {
      const inId = ID_KEYS.has(key);
      if (typeof v === "string") {
        if (inId) {
          if (["series", "headline"].includes(key) && !series.has(v)) problem("editorial", where, `names series "${v}", which the release does not hold`);
          if (["series", "headline"].includes(key)) ids++;
        } else {
          texts++;
          if (/\d/.test(v)) problem("editorial", where, `text holds a number: "${v.slice(0, 80)}"`);
        }
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(j, "");
  }
  return `${files.length} files, ${ids} series ids, ${texts} texts without numbers`;
}
