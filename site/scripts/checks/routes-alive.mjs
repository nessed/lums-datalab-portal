// No address that works today may stop working (AGENTS.md section 3 rule 5; data
// hub plan section 3). routes-baseline.txt lists every prerendered address of the
// build of main taken before the data hub run. Each must still be a page of this
// build, or be redirected (by next.config.ts, read from .next/routes-manifest.json)
// to an address that is one.
import fs from "node:fs";
import path from "node:path";

export default function check({ siteDir, appDir, problem }) {
  const list = fs
    .readFileSync(path.join(siteDir, "scripts", "checks", "routes-baseline.txt"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"));
  const manifest = path.join(siteDir, ".next", "routes-manifest.json");
  const redirects = fs.existsSync(manifest)
    ? JSON.parse(fs.readFileSync(manifest, "utf8")).redirects.filter((r) => !r.internal).map((r) => ({ re: new RegExp(r.regex), to: r.destination }))
    : [];
  const page = (route) => {
    const rel = route === "/" ? "index" : route.slice(1);
    return fs.existsSync(path.join(appDir, `${rel}.html`)) || fs.existsSync(path.join(appDir, `${rel}.body`));
  };
  let direct = 0;
  let moved = 0;
  for (const route of list) {
    if (page(route)) {
      direct++;
      continue;
    }
    const r = redirects.find((x) => x.re.test(route));
    if (r && page(r.to)) moved++;
    else problem("route-dead", route, r ? `redirects to ${r.to}, which is not a page of this build` : "answered in the build before the data hub run and does not now");
  }
  return `${list.length} addresses from the earlier build: ${direct} still pages, ${moved} redirected`;
}
