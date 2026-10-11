"use client";
// A table as the government printed it, drawn as a site table, beside the page
// image. Selecting a number (click, tap, or Enter) boxes it on the page and
// shows a link to its receipt; Ctrl/Cmd-click and middle-click open the
// receipt directly. Only checked figures carry a number; gaps carry their
// status and link to their receipt; unused printed cells show "·".
import { useRef, useState } from "react";

export type TVCell = {
  id: string;
  r: number;
  c: number;
  /** "v": a checked figure (text is the printed text); otherwise a status key. */
  state: "v" | "gap-source" | "gap-pending" | "withheld" | "disputed" | "unknown" | "none";
  text: string | null;
  label: string | null;
  href: string | null;
  box: number[] | null;
  series: string | null;
  seriesHref: string | null;
  unit: string | null;
};

export type TVProps = {
  rows: { index: number; label: string | null }[];
  cols: { index: number; label: string | null }[];
  cells: TVCell[];
  image: { src: string; width: number; height: number } | null;
  tableBox: number[] | null;
  /** The table title and the document title (two release labels). */
  caption: [string, string];
  pageWords: string;
};

const pc = (n: number) => `${(n * 100).toFixed(3)}%`;
const FILL: Record<string, string> = { "gap-source": "cell-gap-source", "gap-pending": "cell-gap-pending", withheld: "cell-withheld", disputed: "cell-disputed" };

export default function TableView({ rows, cols, cells, image, tableBox, caption, pageWords }: TVProps) {
  const [sel, setSel] = useState<string | null>(null);
  const figure = useRef<HTMLDivElement>(null);
  const at = new Map(cells.map((c) => [`${c.r}|${c.c}`, c]));
  const selected = sel ? cells.find((c) => c.id === sel) : undefined;
  const rowOf = (r: number) => rows.find((x) => x.index === r)?.label;
  const colOf = (c: number) => cols.find((x) => x.index === c)?.label;

  const onPick = (e: React.MouseEvent, c: TVCell) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    setSel(c.id);
  };

  return (
    <div className="tv">
      <div className="tv-table">
        <div className="table-wrap dt-sticky tv-scroll" role="region" aria-label={`${caption[0]}, ${caption[1]}`} tabIndex={0}>
          <table className="tv-grid">
            <caption className="sr-only">
              {caption[0]}, {caption[1]}. Row and column labels as printed. Select a number to see where it is on the page.
            </caption>
            <thead>
              <tr>
                <th scope="col">Row as printed</th>
                {cols.map((c) => (
                  <th key={c.index} scope="col" className="num" data-num="text">
                    {c.label ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index}>
                  <th scope="row" data-num="text">
                    {r.label ?? ""}
                  </th>
                  {cols.map((c) => {
                    const cell = at.get(`${r.index}|${c.index}`);
                    if (!cell) return <td key={c.index} />;
                    const isSel = sel === cell.id;
                    if (cell.state === "v")
                      return (
                        <td key={c.index} className={`num tv-v${isSel ? " is-sel" : ""}`}>
                          <a href={cell.href!} className="v-link" data-v="" data-v-cell={cell.id} onClick={(e) => onPick(e, cell)} aria-describedby="tv-hint" aria-current={isSel ? "true" : undefined}>
                            {cell.text}
                          </a>
                        </td>
                      );
                    if (cell.state === "none")
                      return (
                        <td key={c.index} className="num tv-none">
                          <span aria-hidden="true">·</span>
                          <span className="sr-only">printed, not read into any series</span>
                        </td>
                      );
                    return (
                      <td key={c.index} className={`num ${FILL[cell.state] ?? ""}${isSel ? " is-sel" : ""}`}>
                        <a href={cell.href!} className="gap-link" onClick={(e) => (cell.box ? onPick(e, cell) : undefined)}>
                          {cell.label}
                        </a>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" id="tv-hint">
          Select a number to box it on the page; its receipt link appears under the page. Ctrl or Cmd and click opens the receipt straight away.
        </p>
      </div>
      <div className="tv-page">
        {image ? (
          <div className="tv-doc" ref={figure}>
            <div className="tv-doc-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={`${pageWords}. The table is outlined; the selected figure is boxed.`} width={image.width} height={image.height} loading="lazy" decoding="async" />
              {tableBox ? <div className="doc-table" style={{ left: pc(tableBox[0]), top: pc(tableBox[1]), width: pc(tableBox[2] - tableBox[0]), height: pc(tableBox[3] - tableBox[1]) }} /> : null}
              {selected?.box ? (
                <div
                  className="doc-box tv-box"
                  data-cell-box={selected.id}
                  style={{ left: pc(selected.box[0] - 0.004), top: pc(selected.box[1] - 0.004), width: pc(selected.box[2] - selected.box[0] + 0.008), height: pc(selected.box[3] - selected.box[1] + 0.008) }}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <p className="small">No image of this page is in this release.</p>
        )}
        <div className="tv-sel" aria-live="polite">
          {selected ? (
            <>
              <p className="tv-sel-where">
                <strong>Selected:</strong> {rowOf(selected.r) ?? "row"} · {colOf(selected.c) ?? "column"}
              </p>
              <p>
                {selected.state === "v" ? (
                  <>
                    <a href={selected.href!} className="v-link" data-v="" data-v-cell={selected.id}>
                      {selected.text}
                    </a>{" "}
                    <span className="muted">{selected.unit}, checked</span>
                  </>
                ) : (
                  <span>{selected.label}</span>
                )}
              </p>
              <p className="tv-sel-links">
                <a className="btn btn-primary" href={selected.href!}>
                  Open the receipt
                </a>
                {selected.seriesHref ? (
                  <a className="btn" href={selected.seriesHref}>
                    The series
                  </a>
                ) : null}
                <button type="button" className="btn tv-to-page" onClick={() => figure.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                  See it on the page
                </button>
              </p>
            </>
          ) : (
            <p className="muted small">Nothing selected yet. The dashed outline is the table the figures were read from.</p>
          )}
        </div>
      </div>
    </div>
  );
}
