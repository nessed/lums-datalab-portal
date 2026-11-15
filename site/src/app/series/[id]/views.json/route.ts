// The derived views of one series (Units: % change, change, index, share of
// the parent; and the change from budget to revised), as one static JSON file
// written at build time. The series page draws "As printed" from its own HTML
// and fetches this file only when a reader picks another unit, so the first
// load stays small. Every value here is computed by src/lib/series-derive.ts
// from figures whose reader status allows it; scripts/checks/series-derived.mjs
// recomputes each one independently from the release files.
import { db, RELEASE_VERSION, slugify, visibleSeries } from "@/lib/data";
import { derivedViews } from "@/components/series/model";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return visibleSeries().map((s) => ({ id: slugify(s.series_id) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = db().seriesBySlug.get(id) ?? db().seriesBySlug.get(decodeURIComponent(id));
  if (!s) return new Response("not found", { status: 404 });
  return Response.json({ release: RELEASE_VERSION, series: s.series_id, views: derivedViews(s) });
}
