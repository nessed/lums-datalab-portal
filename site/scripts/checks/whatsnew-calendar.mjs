// What's new on /releases, "Official release dates" (design set 2026-11-23).
// Written independently of src/app/releases/page.tsx. home-calendar.mjs checks
// editorial/calendar.json itself and the home page; this checks the same dates
// where /releases shows them: every date (data-cal="<id>") names a real entry,
// reads as that entry's month in words (or its day, if announced) and is
// introduced as "Expected" unless the agency announced it; and every entry of
// the file is shown once.
import fs from "node:fs";
import path from "node:path";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function check({ siteDir, appDir, problem }) {
  const page = "/releases";
  const file = path.join(siteDir, "editorial", "calendar.json");
  if (!fs.existsSync(file)) return "no calendar (reported by home-calendar)";
  const cal = JSON.parse(fs.readFileSync(file, "utf8"));
  const byId = new Map((cal.entries ?? []).map((e) => [e.id, e]));
  const p = path.join(appDir, "releases.html");
  if (!fs.existsSync(p)) {
    problem("whatsnew-calendar", page, "page not built");
    return "page not built";
  }
  const html = fs.readFileSync(p, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!-- -->/g, "");
  const seen = new Map();
  for (const m of html.matchAll(/(Expected |Announced for )?<span([^>]*\bdata-cal="([^"]*)"[^>]*)>([^<]*)<\/span>/g)) {
    const [, intro, , id, text] = m;
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const e = byId.get(id);
    if (!e) {
      problem("whatsnew-calendar", page, `a date names calendar entry "${id}", which editorial/calendar.json does not hold`);
      continue;
    }
    const [y, mo] = String(e.when ?? "").split("-");
    const want = e.status === "announced" ? e.when : `${MONTHS[Number(mo) - 1]} ${y}`;
    if (text.trim() !== want) problem("whatsnew-calendar", page, `"${text}" for ${id} should read "${want}"`);
    const wantIntro = e.status === "announced" ? "Announced for " : "Expected ";
    if (intro !== wantIntro) problem("whatsnew-calendar", page, `the date for ${id} must be introduced as "${wantIntro.trim()}"`);
  }
  for (const id of byId.keys()) if ((seen.get(id) ?? 0) !== 1) problem("whatsnew-calendar", page, `calendar entry ${id} is shown ${seen.get(id) ?? 0} times, not once`);
  return `${seen.size} calendar dates on ${page}`;
}
