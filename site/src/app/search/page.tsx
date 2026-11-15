// /search?q= : the search results page (DESIGN.md 9.9, 10.8). Static HTML; the
// results are drawn in the browser from the same index and ranking as the
// header search (src/lib/search.ts). Chosen over /browse?q= as the results page
// because search returns documents, tables and answer cards as well as series;
// /browse?q= still filters the catalogue with the same ranking.
import type { Metadata } from "next";
import SearchPage from "@/components/search/SearchPage";
import { DATA_BASE } from "@/lib/data";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every series, document and table in the release by topic, plain words or official names, with the latest checked figure.",
};

export default function Page() {
  return <SearchPage indexUrl={`${DATA_BASE}/search.json`} />;
}
