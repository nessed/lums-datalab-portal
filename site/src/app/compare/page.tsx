// Compare up to three series. The page is static; the series to show are in
// the URL (?s=a,b,c) and the browser loads their release files.
import type { Metadata } from "next";
import Compare from "@/components/Compare";
import { Breadcrumbs } from "@/components/ui/Basics";
import { DATA_BASE, db } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compare series",
  description: "Up to three series on one chart, with every figure linked to its receipt. The link reproduces the comparison.",
};

// A default comparison so the page is never empty. Ids that are not in the
// release are dropped.
const DEFAULT = ["fed.exp.current.function.health", "fed.exp.current.function.education_affairs_and_services"];

export default function ComparePage() {
  const d = db();
  const initial = DEFAULT.filter((id) => d.seriesById.has(id));
  return (
    <>
      <Breadcrumbs items={[{ href: "/browse", label: "Browse" }, { label: "Compare" }]} />
      <header className="page-head">
        <h1>Compare series</h1>
        <p className="lede">
          Put up to three series side by side. Series in the same unit share one chart; otherwise each gets its own. The address of this page records
          the choice, so a link reproduces it.
        </p>
      </header>
      <Compare dataBase={DATA_BASE} initial={initial} />
    </>
  );
}
