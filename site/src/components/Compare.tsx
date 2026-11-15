"use client";
// The chart builder (DESIGN.md 9.6): up to six series, added by search on the
// page or from "Compare" on a series (/compare?s=<id>). The whole view lives in
// the URL: ?s=<id>,<id>&show=printed|index|change|share&base=<period>&total=<id>&v=re.
//
// "Show as" puts the series on a common basis instead of second axes:
//   As printed      one chart per unit (small multiples on a shared period axis)
//   Index           chosen period = 100
//   % change        from a year earlier
//   Share           of a chosen total
// Transforms are derived from checked figures only (compare/transform.ts, unit
// tested); a value computed from any other figure is held back with its reason.
// Each series' file is public/data/<release>/compare/<id>.json (checked against
// the release by scripts/checks/take-files.mjs). The default view arrives with
// the page, and every chart has a fixed height, so nothing shifts on load.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setQuery, useQuery } from "@/lib/url-state";
import { search, type SearchEntry } from "@/lib/search";
import { KIND } from "@/lib/words";
import type { KindKey } from "@/lib/adapter/contract";
import { formatCitation, longDate } from "@/lib/cite-format";
import CompareChart, { type ChartLine, type ChartSpec, type LineStyle } from "@/components/compare/CompareChart";
import {
  asPrinted,
  defaultBase,
  excluded,
  fmtDerived,
  indexTo,
  kindFor,
  notComparable,
  parseShow,
  pctChange,
  periodLabel,
  pointsOf,
  shareOf,
  SHOW_AS,
  statusWord,
  timeOf,
  toCsv,
  type SeriesData,
  type Shown,
  type ShowAs,
} from "@/components/compare/transform";
import { Sheet } from "@/components/actions/Sheet";
import { CiteFormats, PrototypeNote, ShareLinks } from "@/components/actions/CiteBody";

export type CompareRelease = { id: string; year: string; doi: string | null; isPrototype: boolean; siteUrl: string; generated: string; licence: string };

export const MAX = 6;
// The categorical palette (tokens --cat-1..6), each with its own dash and marker cap.
const STYLES: LineStyle[] = [
  { color: "#2a78d6", dash: null, cap: "round" },
  { color: "#d4561f", dash: "6 4", cap: "square" },
  { color: "#16936a", dash: "2 3", cap: "round" },
  { color: "#b07800", dash: "8 3 2 3", cap: "square" },
  { color: "#cc4f86", dash: "10 4", cap: "round" },
  { color: "#2f7d1a", dash: "3 3", cap: "square" },
];
const slug = (id: string) => id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
const isSD = (x: SeriesData | "error" | undefined): x is SeriesData => !!x && x !== "error";
const kindWords = (k: string) => (KIND as Record<string, { long: string }>)[k]?.long ?? k;
const STEP: Record<string, number | null> = { fiscal_year: 1, month: 1 / 12, survey_round: null };
type IndexRow = { id: string; n: string; d: string; u: string; y: string; c: number; p: string };

function Swatch({ style }: { style: LineStyle }) {
  return (
    <svg className="cmp-swatch" width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">
      <line x1="1" y1="5" x2="25" y2="5" stroke={style.color} strokeWidth="2" strokeDasharray={style.dash ?? undefined} />
      {style.cap === "square" ? <rect x="9" y="1" width="8" height="8" fill={style.color} /> : <circle cx="13" cy="5" r="4" fill={style.color} />}
    </svg>
  );
}

export default function Compare({
  release,
  dataBase,
  initial,
  initialData,
}: {
  release: CompareRelease;
  dataBase: string;
  initial: string[];
  initialData: Record<string, SeriesData>;
}) {
  const q = useQuery();
  const sParam = q.get("s");
  const ids = [...new Set(sParam === null ? initial : sParam === "none" ? [] : sParam.split(",").filter(Boolean))].slice(0, MAX);
  const show = parseShow(q.get("show"));
  const askedKind = q.get("v");
  const baseAsked = q.get("base");
  const totalAsked = q.get("total");
  const [data, setData] = useState<Record<string, SeriesData | "error">>(initialData);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const loaded = ids.map((id) => data[id]).filter(isSD);
  // Totals a share can be taken of: the parents of the chosen series, and the chosen series themselves.
  const totalCandidates = show === "share" ? [...new Set([...loaded.map((s) => s.parent).filter((x): x is string => !!x), ...ids])] : [];
  const want = [...ids, ...totalCandidates];
  const wantKey = want.join(",");
  useEffect(() => {
    let live = true;
    for (const id of wantKey.split(",").filter(Boolean)) {
      if (data[id]) continue;
      fetch(`${dataBase}/compare/${slug(id)}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: SeriesData) => live && setData((d) => ({ ...d, [id]: j })))
        .catch(() => live && setData((d) => ({ ...d, [id]: "error" })));
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantKey, dataBase]);

  const loadIndex = () => {
    if (index) return;
    fetch(`${dataBase}/compare/index.json`)
      .then((r) => r.json())
      .then((rows: IndexRow[]) => setIndex(rows.map((r) => ({ k: "s" as const, id: r.id, n: r.n, d: r.d, u: r.u, y: r.y, c: r.c, p: r.p, h: "" }))))
      .catch(() => setIndex([]));
  };
  const results = index && text.trim() ? search(index, text, 8).filter((e) => !ids.includes(e.id)) : [];
  const setIds = (next: string[]) => setQuery({ s: next.length ? next.join(",") : "none" });

  const styleOf = (id: string) => STYLES[Math.max(0, ids.indexOf(id)) % STYLES.length];
  const failed = ids.filter((id) => data[id] === "error");
  const ready = loaded.length === ids.length && ids.length > 0;

  /* ---------- the numbers ---------- */
  const kinds = new Map(loaded.map((sd) => [sd.id, kindFor(sd, askedKind)]));
  const ptsOf = (sd: SeriesData) => pointsOf(sd, kinds.get(sd.id) ?? kindFor(sd, askedKind));
  const amountIds = totalCandidates.filter((id) => {
    const t = data[id];
    return isSD(t) && (t.u === "PKR" || t.u === "persons");
  });
  const totalId = show === "share" ? (totalAsked && amountIds.includes(totalAsked) ? totalAsked : (amountIds.find((id) => !ids.includes(id)) ?? amountIds[0] ?? null)) : null;
  const total = totalId && isSD(data[totalId]) ? (data[totalId] as SeriesData) : null;
  const why = new Map(loaded.map((sd) => [sd.id, sd.id === totalId ? "it is the total" : excluded(sd, show, total)]));
  const charted = loaded.filter((sd) => !why.get(sd.id));
  const basePeriods = [...new Set(charted.flatMap((sd) => ptsOf(sd).filter((x) => x.d === 1).map((x) => x.p)))].sort();
  const base = show === "index" ? (baseAsked && basePeriods.includes(baseAsked) ? baseAsked : defaultBase(charted.map((sd) => ({ sd, pts: ptsOf(sd) })))) : null;
  const shownOf = (sd: SeriesData): Shown[] => {
    const pts = ptsOf(sd);
    if (show === "index") return base ? indexTo(pts, base, sd.f, sd.br) : asPrinted([]);
    if (show === "change") return pctChange(pts, sd.f, sd.br);
    if (show === "share") return total ? shareOf(pts, pointsOf(total, kinds.get(sd.id) ?? "be"), total.n, sd.f) : [];
    return asPrinted(pts);
  };
  const shown = new Map(charted.map((sd) => [sd.id, shownOf(sd)]));

  /* ---------- the charts ---------- */
  const allT = charted.flatMap((sd) => ptsOf(sd).map((x) => timeOf(x.p, sd.f)).filter((t): t is number => t !== null));
  const annualOnly = charted.every((sd) => sd.f !== "month");
  const pad = annualOnly ? 0.5 : 1 / 24;
  const xDomain: [number, number] = allT.length ? [Math.min(...allT) - pad, Math.max(...allT) + pad] : [0, 1];
  const xTicks = (() => {
    const lo = Math.ceil(xDomain[0]);
    const hi = Math.floor(xDomain[1]);
    const span = Math.max(1, hi - lo);
    const every = span <= 5 ? 1 : span <= 10 ? 2 : span <= 25 ? 5 : 10;
    const out: { t: number; label: string }[] = [];
    for (let n = Math.ceil(lo / every) * every; n <= hi; n += every) out.push({ t: n, label: annualOnly ? `${n - 1}-${String(n % 100).padStart(2, "0")}` : String(n) });
    return out;
  })();
  const lineOf = (sd: SeriesData): ChartLine => ({
    id: sd.id,
    name: sd.n,
    style: styleOf(sd.id),
    step: STEP[sd.f] ?? null,
    pts: (shown.get(sd.id) ?? [])
      .map((s) => ({
        t: timeOf(s.p, sd.f) ?? NaN,
        y: s.y,
        label: `${periodLabel(s.p, sd.f)}${s.k !== "as_printed" ? `, ${kindWords(s.k)}` : ""}`,
        text: `${s.text}${s.status === "candidate" ? " (not signed off)" : ""}`,
        href: `/o/${s.o}`,
      }))
      .filter((p) => Number.isFinite(p.t)),
  });
  const breaksOf = (list: SeriesData[]) =>
    list
      .flatMap((sd) =>
        sd.br
          .map((b) => ({ t: (timeOf(b.p, sd.f) ?? NaN) - (STEP[sd.f] ?? 1) / 2, label: "break" }))
          .filter((b) => Number.isFinite(b.t) && b.t > xDomain[0] && b.t < xDomain[1]),
      )
      .filter((b, i, all) => all.findIndex((x) => Math.abs(x.t - b.t) < 1e-9) === i);
  const groups: { key: string; list: SeriesData[] }[] = [];
  if (show === "printed") {
    for (const sd of charted) {
      const key = `${sd.u}|${sd.sf}|${sd.base ?? ""}|${sd.def ?? ""}`;
      const g = groups.find((x) => x.key === key);
      if (g) g.list.push(sd);
      else groups.push({ key, list: [sd] });
    }
  } else if (charted.length) groups.push({ key: show, list: charted });
  const derivedNote = "Derived from checked figures only; a value that would use any other figure is left out, and the table says why.";
  const subtitle = (list: SeriesData[]) => {
    const mine = [...new Set(list.map((sd) => kinds.get(sd.id) ?? ""))].filter((k) => k && k !== "as_printed");
    const ks = mine.length ? `; ${mine.map(kindWords).join(" and ")}` : "";
    if (show === "printed") return <>{list[0].uw}, as printed{ks}.</>;
    if (show === "index")
      return (
        <>
          Index, <span data-num="period">{base ? periodLabel(base, list[0].f) : ""}</span> = <span data-num="ui">100</span>
          {ks}. {derivedNote}
        </>
      );
    if (show === "change") return <>Per cent change from a year earlier{ks}. {derivedNote}</>;
    return (
      <>
        Per cent of {total?.n ?? "the total"}
        {ks}. {derivedNote}
      </>
    );
  };
  const specOf = (list: SeriesData[]): ChartSpec => ({
    lines: list.map(lineOf),
    xDomain,
    xTicks,
    breaks: breaksOf(list),
    show,
    unit: list[0].u,
    scale: list[0].sf,
    height: groups.length > 1 ? 200 : 260,
    label: `Chart of ${list.map((s) => s.n).join("; ")}, ${SHOW_AS.find((x) => x.key === show)?.label.toLowerCase()}. Every figure is in the table below.`,
  });

  /* ---------- words above the chart ---------- */
  const clauses = ready ? notComparable(loaded, kinds, show) : [];
  // One sentence per break (period and kind), naming every series it touches.
  const breakNotes: { key: string; names: string[]; p: string; kind: string }[] = [];
  if (ready)
    for (const sd of loaded)
      for (const b of sd.br) {
        const p = periodLabel(b.p, sd.f);
        const kind = b.k.replaceAll("_", " ");
        const hit = breakNotes.find((n) => n.p === p && n.kind === kind);
        if (hit) hit.names.push(sd.n);
        else breakNotes.push({ key: `${p}|${kind}`, names: [sd.n], p, kind });
      }
  const exclNotes = ready ? loaded.filter((sd) => why.get(sd.id)).map((sd) => ({ id: sd.id, name: sd.n, why: why.get(sd.id)! })) : [];
  const hasStages = loaded.some((sd) => sd.pts.some((x) => x.k === "be") && sd.pts.some((x) => x.k === "re"));

  /* ---------- the view as a link, a citation and a file ---------- */
  const viewQuery = (() => {
    const p = new URLSearchParams();
    p.set("s", ids.join(","));
    if (show !== "printed") p.set("show", show);
    if (base) p.set("base", base);
    if (totalId) p.set("total", totalId);
    if (askedKind) p.set("v", askedKind);
    return p.toString().replaceAll("%2C", ",");
  })();
  const viewPath = `/compare?${viewQuery}`;
  const pinnedView = `/${release.id}${viewPath}`;
  const origin = release.siteUrl ? release.siteUrl.replace(/\/$/, "") : "{{ORIGIN}}";
  const showWords =
    show === "index" ? `shown as an index, ${base ? periodLabel(base, loaded[0]?.f ?? "") : ""} = 100` : show === "change" ? "shown as % change from a year earlier" : show === "share" ? `shown as a share of ${total?.n ?? "a total"}` : "as printed";
  const viewTitle = `Compare: ${loaded.map((s) => s.n).join("; ")}, ${showWords}`;
  const cited = {
    kind: "view" as const,
    title: viewTitle,
    pinned: pinnedView,
    out: formatCitation({
      release: { id: release.id, year: release.year, doi: release.doi, isPrototype: release.isPrototype },
      url: `${origin}${pinnedView}`,
      accessed: longDate(release.generated),
      accessedIso: release.generated,
      bracket: null,
      doc: null,
      title: viewTitle,
    }),
  };

  const csvText = () => {
    const today = new Date().toISOString().slice(0, 10);
    const here = typeof window !== "undefined" ? window.location.origin : "";
    const abs = (p: string) => `${release.siteUrl ? release.siteUrl.replace(/\/$/, "") : here}${p}`;
    const citation = cited.out.sentence.replaceAll("{{ORIGIN}}", here);
    const head = [
      "series_id",
      "series_name",
      "period",
      "kind",
      "shown_as",
      "shown_value",
      "derived_formula",
      "derived_from",
      "value",
      "unit",
      "status",
      "status_reason",
      "printed_in",
      "page",
      "receipt_url",
      "release",
      "generated",
      "licence",
      "citation",
      "view_url",
      "is_this_current",
    ];
    const rows: (string | null)[][] = [head];
    for (const sd of loaded) {
      const s = shown.get(sd.id);
      for (const x of ptsOf(sd)) {
        const d = s?.find((y) => y.p === x.p);
        const derived = show !== "printed" && !!d;
        rows.push([
          sd.id,
          sd.n,
          x.p,
          kindWords(x.k),
          why.get(sd.id) ? `as printed (not ${show}: ${why.get(sd.id)})` : (SHOW_AS.find((y) => y.key === show)?.label ?? show) + (show === "index" && base ? `, ${base} = 100` : show === "share" && total ? `, of ${total.id}` : ""),
          d && d.y !== null ? (derived ? d.y.toFixed(6) : (x.v ?? "")) : "",
          derived && d?.formula ? d.formula : "",
          derived && d ? d.inputs.map((i) => abs(`/${release.id}/o/${i.o}`)).join(" ") : "",
          x.v ?? "",
          sd.uw,
          statusWord(x.s),
          x.r ?? (d?.held ? d.held : ""),
          x.doc ?? "",
          x.pg ?? "",
          abs(`/${release.id}/o/${x.o}`),
          release.id,
          today,
          release.licence,
          citation,
          abs(pinnedView),
          abs("/releases"),
        ]);
      }
    }
    return toCsv(rows);
  };
  // Size of the file before the click, computed in the browser (the server render says "made in your browser").
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const csvBytes = inBrowser && ready ? new Blob([csvText()]).size : null;
  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([csvText()], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `compare-${release.id}-${show}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------- the table ---------- */
  const rowsT = [...new Set(loaded.flatMap((sd) => ptsOf(sd).map((x) => `${timeOf(x.p, sd.f) ?? 0}|${x.p}|${sd.f}`)))].sort(
    (a, b) => Number(a.split("|")[0]) - Number(b.split("|")[0]) || a.localeCompare(b),
  );
  const periodRows = rowsT.reverse().map((k) => {
    const [, p, f] = k.split("|");
    return { p, f };
  });

  return (
    <div className="compare cmp2">
      <div className="cmp-pick">
        <ol className="cmp-chips">
          {ids.map((id) => {
            const f = data[id];
            return (
              <li key={id}>
                <Swatch style={styleOf(id)} />
                {isSD(f) ? <a href={`/series/${slug(id)}`}>{f.n}</a> : <span>{f === "error" ? `${id} (not in this release)` : id}</span>}
                <button type="button" className="btn btn-tiny" onClick={() => setIds(ids.filter((x) => x !== id))}>
                  Remove<span className="sr-only"> {isSD(f) ? f.n : id}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {ids.length < MAX ? (
          <div className="cmp-add">
            <label htmlFor="cmp-q" className="cmp-add-label">
              {ids.length ? "Add a series" : "Choose a series"}
            </label>
            <input
              ref={input}
              id="cmp-q"
              className="input"
              type="search"
              value={text}
              autoComplete="off"
              placeholder="Search: health, CPI food, unemployment…"
              onFocus={loadIndex}
              onChange={(e) => {
                loadIndex();
                setText(e.target.value);
              }}
            />
            {results.length > 0 ? (
              <ul className="cmp-results">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setIds([...ids, r.id]);
                        setText("");
                        input.current?.focus();
                      }}
                    >
                      <span className="r-title">{r.n}</span>
                      <span className="r-meta">
                        {r.d} · {r.u}
                        {r.c ? ` · ${r.p}` : " · no checked values"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <noscript>
              <p className="small">Adding series needs JavaScript. Without it, open a series page and use its Compare button.</p>
            </noscript>
          </div>
        ) : null}
        <span className="cmp-n" data-num="ui">
          {ids.length} of {MAX}
        </span>
      </div>

      <div className="cmp-controls" role="group" aria-label="Show as">
        <span className="ctl">
          <span className="label">Show as</span>
          <span className="seg seg-wrap">
            {SHOW_AS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={show === o.key}
                onClick={() => setQuery({ show: o.key === "printed" ? null : o.key, base: null, total: o.key === "share" ? totalAsked : null }, "replace")}
              >
                {o.label}
              </button>
            ))}
          </span>
        </span>
        {show === "index" && basePeriods.length ? (
          <label className="ctl">
            <span className="label">Base period (= 100)</span>
            <select className="input" value={base ?? ""} onChange={(e) => setQuery({ base: e.target.value }, "replace")}>
              {basePeriods.map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p, charted[0]?.f ?? "")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {show === "share" ? (
          <label className="ctl">
            <span className="label">Share of</span>
            <select className="input" value={totalId ?? ""} onChange={(e) => setQuery({ total: e.target.value }, "replace")} disabled={!amountIds.length}>
              {amountIds.length ? null : <option value="">no amount series to take a share of</option>}
              {amountIds.map((id) => (
                <option key={id} value={id}>
                  {isSD(data[id]) ? (data[id] as SeriesData).n : id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {hasStages ? (
          <span className="ctl">
            <span className="label">Kind of figure</span>
            <span className="seg">
              <button type="button" aria-pressed={askedKind !== "re"} onClick={() => setQuery({ v: null }, "replace")}>
                Budget estimate
              </button>
              <button type="button" aria-pressed={askedKind === "re"} onClick={() => setQuery({ v: "re" }, "replace")}>
                Revised estimate
              </button>
            </span>
          </span>
        ) : null}
      </div>

      <div className="cmp-stage">
        {failed.length ? <p className="small">Not in this release: {failed.join(", ")}.</p> : null}
        {ids.length === 0 ? <p className="measure">Choose up to six series to chart them together, with every figure linked to where it is printed.</p> : null}
        {ids.length > 0 && !ready && failed.length === 0 ? <p className="small muted">Loading the series files…</p> : null}

        {ready && (clauses.length || breakNotes.length || exclNotes.length) ? (
          <div className="cmp-care" role="note">
            {clauses.length ? (
              <p>
                <strong>Not comparable as they stand:</strong> {clauses.join("; ")}.
              </p>
            ) : null}
            {exclNotes.map((n) => (
              <p key={n.id}>
                <strong>{n.name}</strong> is left out of this view: {n.why}.
              </p>
            ))}
            {breakNotes.map((n) => (
              <p key={n.key}>
                {n.names.map((name, i) => (
                  <span key={name}>
                    {i ? (i === n.names.length - 1 ? " and " : ", ") : ""}
                    <strong>{name}</strong>
                  </span>
                ))}{" "}
                {n.names.length > 1 ? "have" : "has"} a series break from <span data-num="period">{n.p}</span> ({n.kind}): figures before and after it are not comparable, and
                {n.names.length > 1 ? " the lines stop" : " its line stops"} there.
              </p>
            ))}
          </div>
        ) : null}

        {ready && groups.length === 0 && loaded.length > 0 ? <p className="measure">None of the chosen series can be shown this way; choose As printed.</p> : null}
        {ready
          ? groups.map((g) => (
              <figure key={g.key} className="cmp-fig">
                <figcaption>
                  <ul className="cmp-key">
                    {g.list.map((sd) => (
                      <li key={sd.id}>
                        <Swatch style={styleOf(sd.id)} /> <span>{sd.n}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="cmp-sub">{subtitle(g.list)}</p>
                </figcaption>
                <CompareChart spec={specOf(g.list)} />
                <p className="cmp-src small muted">
                  Source: {[...new Set(g.list.map((s) => s.ds))].join(", ")}; release <span data-num="version">{release.id}</span>. Tap a point for where it is printed.
                </p>
              </figure>
            ))
          : null}
      </div>

      {ready ? (
        <div className="cmp-take">
          <a className="btn btn-primary" href="#sheet-cmp-dl" aria-haspopup="dialog">
            Download
          </a>
          <a className="btn" href="#sheet-cmp-cite" aria-haspopup="dialog">
            Cite this view
          </a>
          <a className="btn" href="#sheet-cmp-share" aria-haspopup="dialog">
            Share
          </a>
        </div>
      ) : null}

      <Sheet id="sheet-cmp-dl" title="Download this view">
        <ul className="dl-list">
          <li>
            <button type="button" className="dl-file dl-button" onClick={downloadCsv} disabled={!ready}>
              <span className="dl-name">This view, CSV</span>
              <span className="dl-size" data-num="ui">
                {csvBytes !== null ? `${Math.max(1, Math.round(csvBytes / 1024))} KB` : "made in your browser"}
              </span>
            </button>
            <span className="dl-what">
              Every figure of the chosen series, one row each, with what is shown ({SHOW_AS.find((x) => x.key === show)?.label.toLowerCase()}), the formula and inputs of each
              derived value, status and reason, document, page, receipt and the citation of this view.
            </span>
          </li>
        </ul>
        <h3 className="dl-h3">Each series on its own</h3>
        <ul className="dl-list dl-list--compact">
          {loaded.map((sd) => (
            <li key={sd.id}>
              <span className="dl-what">{sd.n}</span>
              <span className="take-row">
                <a href={`${dataBase}/series/${slug(sd.id)}.xlsx`} download>
                  Excel (.xlsx)
                </a>
                <a href={`${dataBase}/series/${slug(sd.id)}.csv`} download>
                  CSV, long
                </a>
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet id="sheet-cmp-cite" title="Cite this view" note={<PrototypeNote release={release.id} isPrototype={release.isPrototype} doi={release.doi} />}>
        <CiteFormats cited={cited} />
      </Sheet>
      <Sheet id="sheet-cmp-share" title="Share this view">
        <ShareLinks pinned={`${origin}${pinnedView}`} latest={`${origin}${viewPath}`} release={release.id} />
      </Sheet>

      {ready && loaded.length > 0 ? (
        <section className="cmp-table">
          <h2>Every figure, by period</h2>
          <div className="table-wrap dt-sticky" role="region" aria-label="Figures of the compared series" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  {loaded.map((sd) => (
                    <th key={sd.id} scope="col" className="num">
                      {sd.n}
                      <span className="cell-sub">
                        {why.get(sd.id) || show === "printed" ? sd.uw : show === "index" ? "index" : "per cent"}
                        {kinds.get(sd.id) !== "as_printed" ? `, ${kindWords(kinds.get(sd.id) as KindKey)}` : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodRows.map(({ p, f }) => (
                  <tr key={`${p}|${f}`}>
                    <th scope="row">
                      <span data-num="period">{periodLabel(p, f)}</span>
                    </th>
                    {loaded.map((sd) => {
                      if (sd.f !== f) return <td key={sd.id} className="num muted" aria-label="no figure for this period" />;
                      const x = ptsOf(sd).find((y) => y.p === p);
                      if (!x) return <td key={sd.id} className="num muted" aria-label="no figure for this period" />;
                      const s = why.get(sd.id) ? asPrinted([x])[0] : shown.get(sd.id)?.find((y) => y.p === p);
                      if (!s) return <td key={sd.id} className="num muted" />;
                      if (s.y === null)
                        return (
                          <td key={sd.id} className={`num cell-${s.status === "held" ? "withheld" : "gap-pending"}`}>
                            <a href={`/o/${s.o}`} className="gap-link" title={s.held ?? undefined}>
                              {s.text}
                              <span className="sr-only">. {s.held}</span>
                            </a>
                          </td>
                        );
                      if (s.formula === null)
                        return (
                          <td key={sd.id} className="num">
                            <a href={`/o/${s.o}`} className="v-link" data-v="" {...(x.s === "candidate" ? { "data-candidate": "" } : {})}>
                              {s.text}
                            </a>
                            {x.s === "candidate" ? <span className="v-mark"> not signed off</span> : null}
                          </td>
                        );
                      return (
                        <td key={sd.id} className="num">
                          <details className="cmp-d" data-derived="">
                            <summary>{s.text}</summary>
                            <span className="cmp-formula">
                              = {s.formula}, from{" "}
                              {s.inputs.map((i, n) => (
                                <span key={i.o}>
                                  {n ? " and " : ""}
                                  <a href={`/o/${i.o}`}>{periodLabel(i.p, sd.f)}</a>
                                </span>
                              ))}
                            </span>
                          </details>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            {show === "printed"
              ? "Figures as printed, each linked to the page it comes from. A figure that has not passed its checks shows its status instead of a number."
              : `Derived values: tap one to see its formula and the figures it uses. ${derivedNote}`}{" "}
            Newest first.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export { fmtDerived };
export type { ShowAs };
