// The chart builder. The page is static; the chosen series are in the URL
// (?s=a,b,c) and the browser loads their release files. The default view
// (editorial.config.json) is rendered with the page, so it never opens empty.
import type { Metadata } from "next";
import editorial from "../../../editorial.config.json";
import Compare, { type SeriesFile } from "@/components/Compare";
import { Breadcrumbs } from "@/components/ui/Basics";
import { DATA_BASE, db, isDatasetPublished } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compare series",
  description: "Up to six series charted together, with every figure linked to its receipt and a combined CSV. The link reproduces the comparison.",
};

export default function ComparePage() {
  const d = db();
  const initial = editorial.compareDefault.filter((id) => {
    const s = d.seriesById.get(id);
    return s && isDatasetPublished(s.dataset);
  });
  // The same shape as public/data/<v>/series/<id>.json (scripts/prebuild.mjs).
  const initialFiles: Record<string, SeriesFile> = {};
  for (const id of initial) {
    const s = d.seriesById.get(id)!;
    initialFiles[id] = {
      series: s as unknown as SeriesFile["series"],
      observations: (d.obsBySeries.get(id) ?? []).map((o) => ({ ...o, value: o.published ? o.value : null })),
    };
  }
  return (
    <>
      <Breadcrumbs items={[{ href: "/browse", label: "Data" }, { label: "Compare" }]} />
      <header className="cmp-head">
        <h1>Compare series</h1>
        <p className="muted">Every figure links to its receipt. The address of this page reproduces the view.</p>
      </header>
      <Compare dataBase={DATA_BASE} initial={initial} initialFiles={initialFiles} />
    </>
  );
}
