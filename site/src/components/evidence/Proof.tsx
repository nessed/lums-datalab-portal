// How a printed figure is proved on screen (DESIGN.md 5.4, 7.1): the pre-cut
// crop for an exact box, the page itself for a tentative box or none, and
// words alone when there is no checked page image. One value decides which:
// the evidence's boxState (model.ts printedEvidence, from the contract's
// Evidence type). Our release has only exact boxes; the other three paths are
// here so a golden release's proofs can reach them without a redesign.
//
// The page image is never edited. Boxes are drawn by the site, over the image.
import type { ReactNode } from "react";
import type { Cell, PageImage } from "@/lib/data";
import { PROOF_WORDS, type BoxState, type CropPlan, type PrintedEvidence } from "./model";

const pc = (n: number) => `${Number((n * 100).toFixed(4))}%`;

function boxStyle(b: number[], pad: number) {
  const x0 = Math.max(0, b[0] - pad);
  const y0 = Math.max(0, b[1] - pad);
  const x1 = Math.min(1, b[2] + pad);
  const y1 = Math.min(1, b[3] + pad);
  return { left: pc(x0), top: pc(y0), width: pc(x1 - x0), height: pc(y1 - y0) };
}

/**
 * The pre-cut crop: one or two windows (row labels; the figure), each with the
 * column headings above when they are further up the page. Every window is a
 * small WebP with set dimensions; the box and the row and column shading are
 * drawn over it. `lazy` for crops inside a collapsed section: the image address
 * is kept in data-src and set by ReceiptEnhance only when the section opens, so
 * nothing is fetched before (loading="lazy" alone is ignored without JavaScript).
 */
export function CropView({ plan, base, alt, lazy, caption }: { plan: CropPlan; base: string; alt: string; lazy?: boolean; caption?: ReactNode }) {
  const segs = [...new Set(plan.windows.map((w) => w.seg))].sort();
  const width = (seg: number) => plan.windows.find((w) => w.seg === seg)?.px[2] ?? 1;
  const total = segs.reduce((a, s) => a + width(s), 0);
  return (
    <figure className="ev-crop-fig">
      <div className="ev-crop" data-split={segs.length > 1 ? "true" : undefined}>
        {segs.map((seg, k) => [
          k > 0 ? (
            <span key={`b${seg}`} className="ev-crop-break" aria-hidden="true">
              <span />
            </span>
          ) : null,
          <div key={seg} className="ev-crop-col" style={{ flex: `${(width(seg) / total).toFixed(4)} 1 0` }}>
            {plan.windows
              .filter((w) => w.seg === seg)
              .map((w, j) => (
                <div key={w.file} className={`ev-crop-win ev-crop-win--${w.part}`}>
                  {j > 0 ? <span className="ev-crop-gap" aria-hidden="true" /> : null}
                  <div className="ev-crop-img" style={{ aspectRatio: `${w.px[2]} / ${w.px[3]}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      {...(lazy ? { "data-src": `${base}${w.file}` } : { src: `${base}${w.file}` })}
                      width={w.px[2]}
                      height={w.px[3]}
                      alt={w.part === "rows" && seg === segs[0] ? alt : ""}
                      decoding="async"
                      fetchPriority={lazy ? undefined : "high"}
                    />
                    {w.bands.map((b, i) => (
                      <span key={i} className="ev-band" style={b} />
                    ))}
                    {w.box ? <span className="ev-box" data-cell-box={plan.cellId} style={w.box} /> : null}
                  </div>
                </div>
              ))}
          </div>,
        ])}
      </div>
      <figcaption className="ev-crop-note">
        {plan.head ? "Column headings at the top, then the rows around the figure. " : ""}
        {plan.segments > 1 ? (
          <span data-num="ui">
            {plan.hidden > 0
              ? `Row labels on the left; ${plan.hidden} ${plan.hidden === 1 ? "column" : "columns"} between them and the figure ${plan.hidden === 1 ? "is" : "are"} not shown in this close-up.`
              : "Row labels on the left; the space between them and the figure is not shown in this close-up."}
          </span>
        ) : null}
        {caption ? <> {caption}</> : null}
      </figcaption>
    </figure>
  );
}

/** The whole page, untouched, with the box (solid or dashed) and the table outline drawn over it. Unless `eager`, the image
 * address waits in data-src until the section holding it is opened (ReceiptEnhance). */
export function WholePage({ image, cell, alt, state, eager }: { image: PageImage; cell: Cell; alt: string; state: BoxState; eager?: boolean }) {
  const b = cell.cell_bbox_norm;
  const t = cell.table_bbox_norm;
  const ok = (x: number[] | null | undefined): x is number[] => Array.isArray(x) && x.length === 4 && x[2] > x[0] && x[3] > x[1];
  return (
    <div className="ev-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...(eager ? { src: image.src } : { "data-src": image.src })} alt={alt} width={image.width} height={image.height} decoding="async" />
      {state === "exact" && ok(t) ? <span className="ev-table" style={boxStyle(t, 0.004)} /> : null}
      {state === "exact" && ok(b) ? <span className="ev-box" data-cell-box={cell.cell_id} style={boxStyle(b, 0.004)} /> : null}
      {state === "tentative" && ok(b) ? <span className="ev-box ev-box--tentative" style={boxStyle(b, 0.004)} /> : null}
    </div>
  );
}

/**
 * The first-screen proof of one printed figure, by proof state:
 *   exact      the pre-cut crop, "Printed here"
 *   tentative  the page scaled to the screen, dashed box, no crop (a crop would assert a position)
 *   none       the page without a box
 *   no-image   no image; the document, page and official link stay (given by the caller)
 */
export function ProofView({
  ev,
  plan,
  image,
  cell,
  base,
  alt,
  caption,
}: {
  ev: PrintedEvidence;
  plan: CropPlan | null;
  image: PageImage | null;
  cell: Cell;
  base: string;
  alt: string;
  caption: ReactNode;
}) {
  const state: BoxState = ev.boxState === "exact" && !plan ? (image ? "none" : "no-image") : ev.boxState;
  if (state === "exact" && plan) {
    return (
      <div className="ev-proof" data-proof="exact">
        <p className="ev-proof-label">{PROOF_WORDS.exact}</p>
        <CropView plan={plan} base={base} alt={alt} caption={caption} />
      </div>
    );
  }
  if ((state === "tentative" || state === "none") && image) {
    return (
      <div className="ev-proof" data-proof={state}>
        <p className="ev-proof-words">{PROOF_WORDS[state]}</p>
        <WholePage image={image} cell={cell} alt={alt} state={state} eager />
        <p className="ev-crop-note">{caption}</p>
      </div>
    );
  }
  return (
    <div className="ev-proof" data-proof="no-image">
      <p className="ev-proof-words">{PROOF_WORDS["no-image"]}</p>
      <p className="ev-crop-note">{caption}</p>
    </div>
  );
}
