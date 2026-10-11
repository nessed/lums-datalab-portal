// Page renders drawn as documents. The image file is never cropped or edited:
// the box is an overlay computed from cell_bbox_norm (fractions of the page,
// top-left origin) and the magnified crop is a window onto the same image.
import type { ReactNode } from "react";
import type { Cell, CropGuides, PageImage } from "@/lib/data";
import ZoomDialog from "./ZoomDialog";

const pc = (n: number) => `${Number((n * 100).toFixed(4))}%`;

export const validBox = (b: number[] | null | undefined): b is number[] =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && Number.isFinite(n)) && b[2] > b[0] && b[3] > b[1];

function boxStyle(b: number[], pad: number) {
  const x0 = Math.max(0, b[0] - pad);
  const y0 = Math.max(0, b[1] - pad);
  const x1 = Math.min(1, b[2] + pad);
  const y1 = Math.min(1, b[3] + pad);
  return { left: pc(x0), top: pc(y0), width: pc(x1 - x0), height: pc(y1 - y0) };
}

function Overlay({ cell, showTable = true, bands }: { cell: Cell; showTable?: boolean; bands?: boolean }) {
  const b = cell.cell_bbox_norm;
  const t = cell.table_bbox_norm;
  return (
    <>
      {showTable && validBox(t) && <div className="doc-table" style={boxStyle(t, 0.004)} />}
      {bands && validBox(b) && validBox(t) ? (
        <>
          <div className="doc-band" style={boxStyle([t[0], b[1], t[2], b[3]], 0.003)} />
          <div className="doc-band" style={boxStyle([b[0], t[1], b[2], t[3]], 0.003)} />
        </>
      ) : null}
      {validBox(cell.cell_bbox_norm) && <div className="doc-box" data-cell-box={cell.cell_id} style={boxStyle(cell.cell_bbox_norm, 0.004)} />}
    </>
  );
}

/** The whole page with the cell boxed, a caption, and zoom on click. */
export function DocPage({
  image,
  cell,
  alt,
  title,
  pageCount,
  caption,
  eager,
}: {
  image: PageImage;
  cell: Cell;
  alt: string;
  title: ReactNode;
  pageCount?: number | null;
  caption?: ReactNode;
  eager?: boolean;
}) {
  const page = (big: boolean) => (
    <div className="doc-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={big ? "" : alt} width={image.width} height={image.height} loading={eager || big ? "eager" : "lazy"} decoding="async" />
      <Overlay cell={cell} />
    </div>
  );
  const where = `Page ${cell.page}${pageCount ? ` of ${pageCount}` : ""}`;
  // Inline, the page is framed to the table (most pages are half empty); the
  // enlarged view shows the whole page.
  const t = cell.table_bbox_norm;
  const fy0 = validBox(t) ? Math.max(0, t[1] - 0.06) : 0;
  const fy1 = validBox(t) ? Math.min(1, t[3] + 0.04) : 1;
  const framed = validBox(t) && fy1 - fy0 < 0.8;
  return (
    <figure className="doc">
      <div className="doc-ground">
        <ZoomDialog label={`Enlarge ${where}`} heading={<>{title} · <span data-num="page">{where}</span></>} large={page(true)}>
          {framed ? (
            <div className="doc-page">
              <CropWindow image={image} cell={cell} x0={0} x1={1} y0={fy0} y1={fy1} alt={alt} showTable lazy={!eager} />
            </div>
          ) : (
            page(false)
          )}
        </ZoomDialog>
      </div>
      <figcaption className="doc-caption">
        <span>
          <span className="doc-title">{title}</span> · <span data-num="page">{where}</span> of the PDF file{framed ? " (shown around the table; select it for the whole page)" : ""}
        </span>
        <span>
          <a href={image.src}>Open the page image</a>
        </span>
        {caption ? <span style={{ flexBasis: "100%" }}>{caption}</span> : null}
      </figcaption>
    </figure>
  );
}

/** One window onto the page: horizontal range [x0, x1], vertical [y0, y1]. */
function CropWindow({ image, cell, x0, x1, y0, y1, alt, bands, showTable = false, lazy }: { image: PageImage; cell: Cell; x0: number; x1: number; y0: number; y1: number; alt: string; bands?: boolean; showTable?: boolean; lazy?: boolean }) {
  const xr = x1 - x0;
  const yr = y1 - y0;
  return (
    <div className="doc-crop-win" style={{ aspectRatio: `${(xr * image.width).toFixed(1)} / ${(yr * image.height).toFixed(1)}` }}>
      <div className="doc-crop-inner" style={{ width: pc(1 / xr), left: pc(-x0 / xr), top: pc(-y0 / yr) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={alt} width={image.width} height={image.height} loading={lazy ? "lazy" : "eager"} decoding="async" />
        <Overlay cell={cell} showTable={showTable} bands={bands} />
      </div>
    </div>
  );
}

/** Magnified crop around the cell. It shows whole rows only (never half a
 * row), the column headings (as a strip above, when they are further up the
 * page), and the printed row label. When the table is too wide to show label
 * and figure in one magnified window, it shows two windows at the same scale
 * (the label column, and the figure with its neighbouring column) and says
 * how many columns between them are not shown. */
export function DocCrop({ image, cell, alt, rows = 2, guides }: { image: PageImage; cell: Cell; alt: string; rows?: number; guides?: CropGuides }) {
  const b = cell.cell_bbox_norm;
  if (!validBox(b)) return null;
  const t = validBox(cell.table_bbox_norm) ? cell.table_bbox_norm : [0, 0, 1, 1];
  const right = Math.min(1, b[2] + 0.02);
  const tableLeft = Math.max(0, t[0] - 0.006);
  // At most about a third of the page width, so the figure is magnified even on a phone.
  const MAX = 0.36;
  const labelRight = guides?.labelRight;
  const lr = labelRight && labelRight > tableLeft && labelRight < b[0] ? labelRight + 0.006 : null;
  let segments: [number, number][];
  let hidden = 0;
  if (right - tableLeft <= MAX || !lr) {
    segments = [[Math.max(tableLeft, right - MAX), right]];
  } else {
    const labelEnd = Math.min(lr, tableLeft + 0.25);
    const prev = guides?.prevLeft;
    const valueLeft = Math.max(labelEnd, prev !== null && prev !== undefined && b[0] - prev < 0.2 ? prev - 0.008 : b[0] - 0.05);
    if (valueLeft - labelEnd < 0.02) segments = [[tableLeft, Math.max(right, tableLeft + MAX)]];
    else {
      segments = [
        [tableLeft, labelEnd],
        [valueLeft, right],
      ];
      hidden = (guides?.cols ?? []).filter(([l, r]) => l >= labelEnd - 0.002 && r <= valueLeft + 0.002).length;
    }
  }
  // Vertical: whole rows, `rows` either side of the figure's row.
  const rs = guides?.rows ?? [];
  const i = guides?.rowIndex ?? -1;
  let y0: number;
  let y1: number;
  if (rs.length > 0 && i >= 0 && i < rs.length) {
    const k = Math.max(0, Math.round(rows));
    const a = rs[Math.max(0, i - k)];
    const z = rs[Math.min(rs.length - 1, i + k)];
    y0 = Math.max(0, a[0] - 0.006);
    y1 = Math.min(1, z[1] + 0.006);
  } else {
    const h = Math.max(b[3] - b[1], 0.008);
    y0 = Math.max(0, b[1] - h * (rows + 0.6));
    y1 = Math.min(1, b[3] + h * (rows + 0.6));
  }
  // Column headings, when they are not already in the window.
  const head = guides?.header && guides.header[1] < y0 - 0.004 ? guides.header : null;
  const totalX = segments.reduce((acc, [a0, a1]) => acc + (a1 - a0), 0);
  return (
    <figure className="doc-crop-fig">
      <div className="doc-crop" data-split={segments.length > 1 ? "true" : undefined}>
        {segments.map(([x0, x1], k) => [
          k > 0 ? (
            <span key={`b${k}`} className="doc-crop-break" aria-hidden="true">
              <span />
            </span>
          ) : null,
          <div key={k} className="doc-crop-col" style={{ flex: `${((x1 - x0) / totalX).toFixed(4)} 1 0` }}>
            {head ? (
              <>
                <CropWindow image={image} cell={cell} x0={x0} x1={x1} y0={head[0]} y1={head[1]} alt="" />
                <span className="doc-crop-gap" aria-hidden="true" />
              </>
            ) : null}
            <CropWindow image={image} cell={cell} x0={x0} x1={x1} y0={y0} y1={y1} alt={k === 0 ? alt : ""} bands />
          </div>,
        ])}
      </div>
      {head || segments.length > 1 ? (
        <figcaption className="doc-crop-note">
          {head ? "Column headings at the top, then the rows around the figure. " : ""}
          {segments.length > 1 ? (
            <span data-num="ui">
              {hidden > 0
                ? `Row labels on the left; ${hidden} ${hidden === 1 ? "column" : "columns"} between them and the figure ${hidden === 1 ? "is" : "are"} not shown in this close-up.`
                : "Row labels on the left; the space between them and the figure is not shown in this close-up."}
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
