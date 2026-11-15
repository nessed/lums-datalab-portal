// The chart builder (DESIGN.md 9.6). The page is static; the view is in the URL
// (?s=a,b&show=index&base=2015-16) and applied in the browser. The default view
// (editorial.config.json) is rendered with the page from the same files the
// browser fetches (public/data/<release>/compare/<id>.json), so it never opens
// empty and it reads, prints and works without JavaScript.
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import editorial from "../../../editorial.config.json";
import Compare from "@/components/Compare";
import type { SeriesData } from "@/components/compare/transform";
import { Breadcrumbs } from "@/components/ui/Basics";
import { PinnedLine } from "@/components/actions/Actions";
import { buildDate, DATA_BASE, db, isDatasetPublished, RELEASE_VERSION, SITE_URL, slugify } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compare series",
  description: "Up to six series on a common basis: as printed, as an index, as a change from a year earlier or as a share of a total. Every figure links to where it is printed.",
};

export default function ComparePage() {
  const d = db();
  const initial = editorial.compareDefault.filter((id) => {
    const s = d.seriesById.get(id);
    return s && isDatasetPublished(s.dataset);
  });
  const initialData: Record<string, SeriesData> = {};
  for (const id of initial) {
    const p = path.join(process.cwd(), "public", "data", RELEASE_VERSION, "compare", `${slugify(id)}.json`);
    if (fs.existsSync(p)) initialData[id] = JSON.parse(fs.readFileSync(p, "utf8")) as SeriesData;
  }
  const release = {
    id: RELEASE_VERSION,
    year: (d.release.created_at ?? "").slice(0, 4) || "n.d.",
    doi: d.release.doi ?? null,
    isPrototype: d.info.isPrototype,
    siteUrl: SITE_URL,
    generated: buildDate(),
    licence: d.info.licence,
  };
  return (
    <>
      <Breadcrumbs items={[{ href: "/browse", label: "Data" }, { label: "Compare" }]} />
      <PinnedLine />
      <header className="cmp-head">
        <h1>Compare series</h1>
        <p className="muted">Up to six series on a common basis. Every figure links to where it is printed; the address of this page reproduces the view.</p>
      </header>
      <Compare release={release} dataBase={DATA_BASE} initial={initial.filter((id) => initialData[id])} initialData={initialData} />
    </>
  );
}
