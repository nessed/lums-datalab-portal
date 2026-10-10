// Shows a page render with one cell boxed. The box is an absolutely positioned
// overlay computed from cell_bbox_norm (fractions of the page, top-left origin).
// The zoomed view is the same image scaled and shifted with CSS; the file
// itself is never cropped.
import type { Cell, PageImage } from "@/lib/data";

const f = (n: number) => `${Number(n.toFixed(3))}%`;

function boxStyle(b: number[], pad: number) {
  const x0 = Math.max(0, b[0] - pad);
  const y0 = Math.max(0, b[1] - pad);
  const x1 = Math.min(1, b[2] + pad);
  const y1 = Math.min(1, b[3] + pad);
  return { left: f(x0 * 100), top: f(y0 * 100), width: f((x1 - x0) * 100), height: f((y1 - y0) * 100) };
}

const validBox = (b: number[] | null | undefined): b is number[] =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && Number.isFinite(n)) && b[2] > b[0] && b[3] > b[1];

export function PageWithBox({ image, cell, alt }: { image: PageImage; cell: Cell; alt: string }) {
  const box = cell.cell_bbox_norm;
  return (
    <div className="page-frame">
      <div className="page-rel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={alt} width={image.width} height={image.height} loading="lazy" />
        {validBox(cell.table_bbox_norm) && <div className="table-box" style={boxStyle(cell.table_bbox_norm, 0.004)} />}
        {validBox(box) && <div className="cell-box" data-cell-box={cell.cell_id} style={boxStyle(box, 0.003)} />}
      </div>
    </div>
  );
}

const CROP_ASPECT = 0.42; // height / width of the zoom window

export function ZoomedCell({ image, cell, alt }: { image: PageImage; cell: Cell; alt: string }) {
  const box = cell.cell_bbox_norm;
  if (!validBox(box)) return null;
  const pageAspect = image.height / image.width;
  const cellW = box[2] - box[0];
  const zoom = Math.min(5, Math.max(2, 0.16 / cellW));
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  // Offsets are fractions of the window, clamped so the page always fills it.
  const heightRatio = (zoom * pageAspect) / CROP_ASPECT; // inner height / window height
  const left = Math.min(0, Math.max(1 - zoom, 0.5 - cx * zoom));
  const top = Math.min(0, Math.max(1 - heightRatio, 0.5 - cy * heightRatio));
  return (
    <div className="zoom-window" style={{ paddingBottom: f(CROP_ASPECT * 100) }}>
      <div className="zoom-inner" style={{ width: f(zoom * 100), left: f(left * 100), top: f(top * 100) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={alt} width={image.width} height={image.height} loading="lazy" />
        <div className="cell-box" style={boxStyle(box, 0.002)} />
      </div>
    </div>
  );
}
