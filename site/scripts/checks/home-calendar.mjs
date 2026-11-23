// Home v2, "Coming up" (2026-11-23). Written independently of
// src/components/hub/HomeV2.tsx.
//
// 1. editorial/calendar.json: every entry has an id, a name and an agency; its
//    status is "expected" (when = a month, YYYY-MM) or "announced" (when = a day,
//    YYYY-MM-DD, and announcedAt = the agency's own https page). The file is
//    marked provisional until a person confirms it.
// 2. The home page: every date shown from the file (data-cal="<id>") names a
//    real entry, reads as that entry's month in words (or its day, if
//    announced), and is introduced as "Expected" unless the agency announced it.
import fs from "node:fs";
import path from "node:path";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function check({ siteDir, appDir, problem }) {
  const file = path.join(siteDir, "editorial", "calendar.json");
  if (!fs.existsSync(file)) {
    problem("home-calendar", "editorial/calendar.json", "missing");
    return "no calendar";
  }
  const cal = JSON.parse(fs.readFileSync(file, "utf8"));
  const byId = new Map();
  for (const e of cal.entries ?? []) {
    const where = `editorial/calendar.json ${e.id ?? "(no id)"}`;
    if (!e.id || !e.name || !e.agency) problem("home-calendar", where, "an entry needs an id, a name and an agency");
    if (byId.has(e.id)) problem("home-calendar", where, "duplicate id");
    byId.set(e.id, e);
    if (e.status === "expected") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.when ?? "")) problem("home-calendar", where, `an expected date is a month (YYYY-MM), not "${e.when}"`);
      if (e.announcedAt) problem("home-calendar", where, "an expected entry has no announcement page; set status to announced if the agency announced it");
    } else if (e.status === "announced") {
      if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(e.when ?? "")) problem("home-calendar", where, `an announced date is a day (YYYY-MM-DD), not "${e.when}"`);
      if (!/^https:\/\//.test(e.announcedAt ?? "")) problem("home-calendar", where, "an announced date needs announcedAt, the agency's own page that announces it");
    } else problem("home-calendar", where, `status is "${e.status}"; it must be "expected" or "announced"`);
  }
  if (cal.provisional !== true && [...byId.values()].some((e) => e.status === "expected")) {
    // Expected dates are an estimate; the file says so until a person confirms it.
    problem("home-calendar", "editorial/calendar.json", "expected dates are an estimate: keep \"provisional\": true until a person confirms them");
  }

  const home = path.join(appDir, "index.html");
  if (!fs.existsSync(home)) return `${byId.size} calendar entries; home page not built`;
  const html = fs.readFileSync(home, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!-- -->/g, "");
  let shown = 0;
  for (const m of html.matchAll(/(Expected |Announced for )?<span([^>]*\bdata-cal="([^"]*)"[^>]*)>([^<]*)<\/span>/g)) {
    shown++;
    const [, intro, , id, text] = m;
    const e = byId.get(id);
    if (!e) {
      problem("home-calendar", "/", `a date names calendar entry "${id}", which editorial/calendar.json does not hold`);
      continue;
    }
    const [y, mo] = e.when.split("-");
    const want = e.status === "announced" ? e.when : `${MONTHS[Number(mo) - 1]} ${y}`;
    if (text.trim() !== want) problem("home-calendar", "/", `"${text}" for ${id} should read "${want}"`);
    const wantIntro = e.status === "announced" ? "Announced for " : "Expected ";
    if (intro !== wantIntro) problem("home-calendar", "/", `the date for ${id} must be introduced as "${wantIntro.trim()}"`);
  }
  return `${byId.size} calendar entries checked, ${shown} dates on the home page`;
}
