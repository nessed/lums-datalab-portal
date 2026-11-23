"use client";
// Home v3 pages set (2026-11-24): the dashboard's moving parts. Every figure is
// rendered on the server and passed in; this component only chooses which
// indicator's panel shows, toggles chart and table, and cycles.
//   - every `cycleSeconds` the selection moves to the next indicator; a gold bar
//     under the active row shows the time left;
//   - cycling pauses while the pointer or focus is inside the dashboard and while
//     the table view is open; selecting a row pins it; a Pause/Cycle button;
//   - prefers-reduced-motion: no cycling at all.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export type DashItem = { key: string; name: string; chart: ReactNode; table: ReactNode; head: ReactNode; foot: ReactNode; row: ReactNode };

const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Dashboard({ items, cycleSeconds = 8, moreHref }: { items: DashItem[]; cycleSeconds?: number; moreHref: string }) {
  const secs = Math.min(15, Math.max(4, cycleSeconds));
  const reduced = useSyncExternalStore(subscribeMotion, reducedNow, () => true);
  const [sel, setSel] = useState(0);
  const [cycling, setCycling] = useState(true);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [over, setOver] = useState(false);
  const [prog, setProg] = useState(0);
  const t0 = useRef(0);
  const on = cycling && !reduced && items.length > 1;
  const running = on && !over && view === "chart";

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const start = performance.now() - prog * secs * 1000;
    t0.current = start;
    const tick = (now: number) => {
      const p = (now - t0.current) / (secs * 1000);
      if (p >= 1) {
        t0.current = now;
        setSel((s) => (s + 1) % items.length);
        setProg(0);
      } else setProg(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // prog is read once at (re)start so a pause resumes where it stopped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secs, items.length]);

  const cur = items[sel];
  const pick = (i: number) => {
    setSel(i);
    setCycling(false);
    setProg(0);
  };

  return (
    <section
      className="dash"
      aria-label="Key indicators"
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setOver(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
    >
      <div className="dash-main">
        {items.map((it, i) => (
          <div key={it.key} className="dash-panel" hidden={i !== sel}>
            <div className="dash-top">
              <div className="dash-head">{it.head}</div>
              <div className="dash-views" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={view === "chart"} onClick={() => setView("chart")}>
                  Chart
                </button>
                <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")}>
                  Table
                </button>
              </div>
            </div>
            <div className="dash-chart" hidden={view !== "chart"}>
              {it.chart}
            </div>
            <div className="dash-table" hidden={view !== "table"}>
              {it.table}
            </div>
            {it.foot}
          </div>
        ))}
      </div>
      <div className="dash-side">
        <div className="dash-side-h">
          <h2>Key indicators</h2>
          <a href={moreHref}>All indicators</a>
        </div>
        <div className="dash-status">
          <span aria-live="polite">{on ? "Showing each indicator in turn. Select one to keep it." : `Showing ${cur?.name ?? ""} only. Select another to chart it.`}</span>
          {!reduced && items.length > 1 ? (
            <button
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCycling((c) => !c);
                setProg(0);
              }}
            >
              {on ? "Pause" : "Cycle"}
            </button>
          ) : null}
        </div>
        <ul className="dash-rows">
          {items.map((it, i) => (
            <li key={it.key} className="dash-row" data-active={i === sel ? "true" : undefined} onClick={(e) => (e.target as Element).closest("a") || pick(i)}>
              <button type="button" className="dash-pick" aria-pressed={i === sel} onClick={() => pick(i)}>
                <span className="sr-only">Show </span>
                {it.name}
              </button>
              {it.row}
              <span className="dash-bar" style={{ width: i === sel && running ? `${(prog * 100).toFixed(1)}%` : 0 }} aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Pakistan at a glance: picks which table row shades the map. The rows and the map are server-rendered. */
export function GlanceSelect({ rows, table, map }: { rows: { key: string; title: string }[]; table: ReactNode; map: ReactNode }) {
  const [sel, setSel] = useState(rows[0]?.key ?? "");
  const title = rows.find((r) => r.key === sel)?.title ?? "";
  return (
    <div
      className="gl-body"
      data-sel={sel}
      onClick={(e) => {
        const tr = (e.target as Element).closest("tr[data-row]");
        if (tr && !(e.target as Element).closest("a")) setSel(tr.getAttribute("data-row") ?? sel);
      }}
    >
      <div className="gl-table">
        <style>{`.gl-body[data-sel="${sel}"] tr[data-row="${sel}"]{background:var(--select-wash);box-shadow:inset 4px 0 0 var(--gold)}`}</style>
        {table}
        <p className="gl-hint">Select a row to map it.</p>
        <div className="gl-pickers" role="group" aria-label="Map this row">
          {rows.map((r) => (
            <button key={r.key} type="button" aria-pressed={r.key === sel} onClick={() => setSel(r.key)}>
              Map {r.title.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <figure className="gl-map">
        <figcaption>{title}</figcaption>
        {map}
        <p className="gl-credit">Boundaries: geoBoundaries (CC BY 4.0). Not an authoritative depiction of borders.</p>
      </figure>
    </div>
  );
}
