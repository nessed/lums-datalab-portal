// The data types of this release, each with its counts and a way in.
import type { Metadata } from "next";
import DataTypeTile from "@/components/DataTypeTile";
import { Breadcrumbs } from "@/components/ui/Basics";
import { COMING } from "@/lib/features";
import { publishedDatasets } from "@/lib/stats";

export const metadata: Metadata = { title: "Data types", description: "The data types in the current release, with their series, checked values and documents." };

export default function DatasetsPage() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/browse", label: "Data" }, { label: "Data types" }]} />
      <h1>Data types</h1>
      <ul className="dt-grid">
        {publishedDatasets().map((k) => (
          <DataTypeTile key={k} k={k} />
        ))}
      </ul>
      <p className="coming">More data types: {COMING}</p>
    </>
  );
}
