"use client";
// The topic page's indicator filter: a text box and a frequency switch. The rows
// are rendered on the server (every figure is in the HTML and checked); this only
// sets `hidden` on rows (data-name, data-freq) and on groups left empty.
import { useRef, useState, type ReactNode } from "react";

export default function IndicatorFilter({ freqs, heading, children }: { freqs: string[]; heading: ReactNode; children: ReactNode }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("All");
  const [none, setNone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const apply = (nq: string, nf: string) => {
    setQ(nq);
    setF(nf);
    const el = box.current;
    if (!el) return;
    const words = nq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const g of el.querySelectorAll<HTMLElement>("[data-group]")) {
      let n = 0;
      for (const tr of g.querySelectorAll<HTMLElement>("tr[data-name]")) {
        const ok = words.every((w) => (tr.dataset.name ?? "").includes(w)) && (nf === "All" || tr.dataset.freq === nf);
        tr.hidden = !ok;
        if (ok) n++;
      }
      g.hidden = n === 0;
      shown += n;
    }
    setNone(shown === 0);
  };
  return (
    <>
      <div className="tp5-ihead">
        {heading}
        <div className="tp5-tools">
        <input type="search" value={q} onChange={(e) => apply(e.target.value, f)} placeholder="Filter indicators" aria-label="Filter indicators" />
        {freqs.length > 1 ? (
          <div className="tp5-freq" role="group" aria-label="Frequency">
            {["All", ...freqs].map((x) => (
              <button key={x} type="button" aria-pressed={f === x} onClick={() => apply(q, x)}>
                {x}
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>
      <div ref={box}>{children}</div>
      {none ? (
        <p className="tp5-none" role="status">
          No indicator matches. Clear the filter to see them all.
        </p>
      ) : null}
    </>
  );
}
