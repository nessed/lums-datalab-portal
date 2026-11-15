// The evidence example on the home page (round 2 item 19): one headline figure
// beside the pre-cut crop of the government page it was printed on, the figure
// boxed, and the "See it on the printed page" pill that opens the one-tap
// evidence sheet. It only places the evidence machinery (components/evidence,
// scripts/prebuild/evidence.mjs, owned by the series area): the crop plan is the
// same model the prebuild cut the files with, so the files exist. Shown only for
// a checked, signed-off figure whose page may be shown and whose box is exact;
// otherwise the section is left out, never faked.
import { CropView } from "@/components/evidence/Proof";
import { cropPlan, pageAllowed, printedEvidence } from "@/components/evidence/model";
import PrintedPagePill from "@/components/ui/PrintedPagePill";
import { obsSlug } from "@/lib/chart-model";
import { DATA_BASE, db, obsHref, pageImage, type Series } from "@/lib/data";
import { seriesTitle } from "@/lib/titles";
import { kindPeriod, PageWords, ShortValue, SourceMarker } from "./Bits";
import { latestShown, showable } from "./derive";

export default function EvidenceExample({ series, kind, words }: { series: Series; kind: string; words: PageWords }) {
  const d = db();
  const { latest: o } = latestShown(d.obsBySeries.get(series.series_id) ?? [], kind);
  if (!o || !showable(o)) return null;
  const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
  if (!cell || !pageAllowed(o, cell)) return null;
  const img = pageImage(cell.source_id, cell.page);
  if (!img || printedEvidence(cell, true).boxState !== "exact") return null;
  const plan = cropPlan(cell, d.cellsBySource.get(cell.source_id) ?? [], img);
  if (!plan) return null;
  return (
    <section className="h-proof" aria-labelledby="proof-h">
      <h2 id="proof-h" className="h-proof-h">
        Every number on this site opens the page it was printed on
      </h2>
      <div className="h-proof-fig">
        <p className="h-proof-label">
          {seriesTitle(series)}, {kindPeriod(o, series, words)}
        </p>
        <p className="h-proof-v">
          <ShortValue o={o} series={series} />
        </p>
      </div>
      <CropView
        plan={plan}
        base={`${DATA_BASE}/evidence/crops/`}
        alt="Close-up of the printed government page: the row of this figure, with the figure boxed."
        caption={<SourceMarker o={o} className="h-proof-src" />}
      />
      <p className="h-proof-act">
        <PrintedPagePill href={obsHref(o.obs_id)} sheet={obsSlug(o.obs_id)} />
      </p>
      <p className="h-proof-note">
        The page, the box around the figure and the checks it passed: one tap on any figure, here or anywhere on the site.
      </p>
    </section>
  );
}
