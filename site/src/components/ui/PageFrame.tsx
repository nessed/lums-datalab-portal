// Page renders drawn as documents. The image file is never cropped or edited:
// the box is an overlay computed from cell_bbox_norm (fractions of the page,
// top-left origin) and the magnified crop is a window onto the same image.
import type { ReactNode } from "react";
import type { Cell, PageImage } from "@/lib/data";
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

function Overlay({ cell, showTable = true }: { cell: Cell; showTable?: boolean }) {
  return (
    <>
      {showTable && validBox(cell.table_bbox_norm) && <div className="doc-table" style={boxStyle(cell.table_bbox_norm, 0.004)} />}
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
  return (
    <figure className="doc">
      <div className="doc-ground">
        <ZoomDialog label={`Enlarge ${where}`} heading={<>{title} · {where}</>} large={page(true)}>
          {page(false)}
        </ZoomDialog>
      </div>
      <figcaption className="doc-caption">
        <span>
          <span className="doc-title">{title}</span> · {where} of the PDF file
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
function CropWindow({ image, cell, x0, x1, y0, y1, alt, grow }: { image: PageImage; cell: Cell; x0: number; x1: number; y0: number; y1: number; alt: string; grow: number }) {
  const xr = x1 - x0;
  const yr = y1 - y0;
  return (
    <div className="doc-crop-win" style={{ flex: `${grow.toFixed(4)} 1 0`, aspectRatio: `${(xr * image.width).toFixed(1)} / ${(yr * image.height).toFixed(1)}` }}>
      <div className="doc-crop-inner" style={{ width: pc(1 / xr), left: pc(-x0 / xr), top: pc(-y0 / yr) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={alt} width={image.width} height={image.height} loading="eager" decoding="async" />
        <Overlay cell={cell} showTable={false} />
      </div>
    </div>
  );
}

/** Magnified crop around the cell, a few rows either side. It always shows the
 * printed row label: when the table is too wide to show label and figure in one
 * magnified window, it shows two windows at the same scale (the label column
 * and the figure with its neighbour), joined by a marked break.
 * `guides` come from cropGuides(): where row labels end and where the neighbouring number starts. */
export function DocCrop({ image, cell, alt, rows = 3, guides }: { image: PageImage; cell: Cell; alt: string; rows?: number; guides?: { labelRight: number | null; prevLeft: number | null } }) {
  const b = cell.cell_bbox_norm;
  if (!validBox(b)) return null;
  const t = validBox(cell.table_bbox_norm) ? cell.table_bbox_norm : [0, 0, 1, 1];
  const right = Math.min(1, b[2] + 0.025);
  const tableLeft = Math.max(0, t[0] - 0.006);
  // Never show more than about a third of the page width, so the figure is
  // magnified even on a phone. Label window: the start of the row label.
  // Figure window: the figure and part of its left neighbour.
  const MAX = 0.34;
  const labelRight = guides?.labelRight;
  const lr = labelRight && labelRight > tableLeft && labelRight < b[0] ? labelRight + 0.006 : null;
  let segments: [number, number][];
  if (right - tableLeft <= MAX || !lr) {
    segments = [[Math.max(tableLeft, right - MAX), right]];
  } else {
    const labelEnd = Math.min(lr, tableLeft + 0.24);
    // Start the figure window at the left edge of the neighbouring number, so
    // no number is cut in half; without one, a little space before the figure.
    const prev = guides?.prevLeft;
    const valueLeft = Math.max(labelEnd, prev !== null && prev !== undefined && b[0] - prev < 0.2 ? prev - 0.008 : b[0] - 0.05);
    segments = valueLeft - labelEnd < 0.02 ? [[tableLeft, Math.max(right, tableLeft + MAX)]] : [
      [tableLeft, labelEnd],
      [valueLeft, right],
    ];
  }
  const totalX = segments.reduce((a, [x0, x1]) => a + (x1 - x0), 0);
  // Vertical: a few row heights either side, and tall enough to read as a crop.
  const h = Math.max(b[3] - b[1], 0.008);
  const cy = (b[1] + b[3]) / 2;
  const minY = (0.42 * totalX * image.width) / image.height;
  const half = Math.max(h * rows, minY / 2);
  let y0 = Math.max(0, cy - half);
  const y1 = Math.min(1, y0 + half * 2);
  if (y1 - y0 < half * 2) y0 = Math.max(0, y1 - half * 2);
  return (
    <div className="doc-crop" data-split={segments.length > 1 ? "true" : undefined}>
      {segments.map(([x0, x1], i) => [
        i > 0 ? (
          <span key={`b${i}`} className="doc-crop-break" title="Columns in between are not shown in the close-up">
            <span aria-hidden="true">···</span>
          </span>
        ) : null,
        <CropWindow key={i} image={image} cell={cell} x0={x0} x1={x1} y0={y0} y1={y1} grow={(x1 - x0) / totalX} alt={i === 0 ? alt : ""} />,
      ])}
    </div>
  );
}
