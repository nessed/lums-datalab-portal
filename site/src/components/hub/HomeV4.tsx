// Home v3 pages set (design handoff, 2026-11-24): the sections of the new home
// page, server components. The design is a picture with demo values: no number
// was copied from it. Every figure is a <V> read from the release, every count a
// <Count> or a derived count a plug-in recomputes (home-publishers), every other
// digit a <Num>; every change is a derived figure (home-derived). A slot the
// release cannot fill shows "Coming soon" or "Not yet collected" in words.
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import Chart from "@/components/Chart";
import Spark from "@/components/Spark";
import { Count, Num, V } from "@/components/ui/Num";
import SearchDialog from "@/components/chrome/SearchDialog";
import Dashboard, { GlanceSelect, type DashItem } from "./Dashboard";
import InflationCalc, { type CalcPoint, type CalcSlot } from "@/components/pages/InflationCalc";
import { PageRef } from "@/components/pages/PageRef";
import { buildChart } from "@/lib/chart";
import { DATA_BASE, db, library, seriesCsvHref, seriesHref, sourceHref, visibleSeries, type Observation, type Series } from "@/lib/data";
import { dateOnly, periodWords, unitLabel } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";
import { isOn } from "@/lib/features";
import { DerivedNotes, DerivedValue, ShortValue, SourceMarker } from "@/components/home/Bits";
import { dirOf } from "@/components/home/Cards";
import { compare, latestShown, ofKind, showable, usable } from "@/components/home/derive";
import { headlineCards, topics, topicHref } from "@/components/home/editorial";
import editorialConfig from "../../../editorial.config.json";
import daily from "../../../editorial/daily.json";
import calendar from "../../../editorial/calendar.json";
import geo from "../../geo/pak-adm1.json";

const P = (p: string, s: Pick<Series, "frequency">) => <Num kind="period">{periodWords(p, s.frequency)}</Num>;

function Head({ id, children, more, note }: { id: string; children: ReactNode; more?: ReactNode; note?: ReactNode }) {
  return (
    <div className="h4-head">
      <div className="h4-head-l">
        <h2 id={id}>{children}</h2>
        {note ? <span className="h4-note">{note}</span> : null}
      </div>
      {more ? <span className="h4-more">{more}</span> : null}
    </div>
  );
}

/* ============================== 1 search band ============================== */

/** Publishers with at least one published series, and those series (same rule as scripts/checks/home-publishers.mjs). */
function publisherSeries(): Map<string, Set<string>> {
  const d = db();
  const visible = new Set(Object.keys(d.release.dataset_status ?? {}).filter((k) => ["published", "candidate"].includes(d.release.dataset_status?.[k]?.state ?? "")));
  const out = new Map<string, Set<string>>();
  for (const s of d.series) {
    if (!visible.has(s.dataset)) continue;
    for (const o of d.obsBySeries.get(s.series_id) ?? []) {
      if (!(o.published && o.value !== null) || !o.primary_cell_id) continue;
      const src = d.sourceById.get(d.cellById.get(o.primary_cell_id)?.source_id ?? "");
      if (!src?.publisher) continue;
      if (!out.has(src.publisher)) out.set(src.publisher, new Set());
      out.get(src.publisher)!.add(s.series_id);
    }
  }
  return out;
}

export function SearchBand() {
  const pubs = publisherSeries();
  const updated = dateOnly(db().release.created_at);
  return (
    <section className="sb4" aria-label="Search">
      <div className="wrap sb4-in">
        <div className="sb4-top">
          <h1>Pakistan&rsquo;s economy in official numbers</h1>
          <p className="sb4-meta">
            <Count k="series" n={visibleSeries().length} /> series from{" "}
            <span data-num="derived" data-derived="publishers">
              {pubs.size}
            </span>{" "}
            official publishers · updated <Num kind="date">{updated}</Num>
          </p>
        </div>
        <SearchDialog indexUrl={`${DATA_BASE}/search.json`} variant="big" />
        {editorialConfig.exampleSearches?.length ? (
          <p className="sb4-often">
            <span className="sb4-often-h">Often searched</span>
            {editorialConfig.exampleSearches.map((t) => (
              <Link key={t} href={`/search?q=${encodeURIComponent(t)}`}>
                {t}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ================================ 3 dashboard ================================ */

const KIND_WORDS: Record<string, string> = { be: "Budget estimate", re: "Revised estimate", actual: "Actual", change_yoy: "Change over a year", survey_round: "Survey" };

function basis(base: Observation, s: Series): ReactNode {
  if (base.kind === "be") return <>on the {P(base.period, s)} budget estimate</>;
  if (base.kind === "re") return <>on the {P(base.period, s)} revised estimate</>;
  if (base.kind === "survey_round") return <>on the {P(base.period, s)} survey</>;
  return <>on {P(base.period, s)}</>;
}

/**
 * The featured chart and the key indicators list. The headline changes are added
 * to `notes` in headline order, as KeyTiles did, so their "how" links still land
 * on the same entries of the list on /methods.
 */
export function HomeDashboard({ notes }: { notes: DerivedNotes }) {
  const items: DashItem[] = [];
  for (const c of headlineCards()) {
    const s = c.series;
    const all = db().obsBySeries.get(s.series_id) ?? [];
    const { latest } = latestShown(all, c.kind);
    if (!latest) continue;
    const cmp = compare(s, latest, all);
    let chg: ReactNode = null;
    let short: ReactNode = null;
    if (cmp.kind === "change") {
      const id = notes.add(cmp.derived, `${c.name}: change on the comparable figure`);
      chg = (
        <>
          <Arrow dir={dirOf(cmp.derived)} label={false} />{" "}
          <a href={notes.href(id)} className="kt-drv">
            <DerivedValue d={cmp.derived} />
          </a>{" "}
          {basis(cmp.base, s)}
        </>
      );
      short = (
        <>
          <Arrow dir={dirOf(cmp.derived)} label={false} /> <DerivedValue d={cmp.derived} />
        </>
      );
    } else if (cmp.kind === "break") chg = <>Not compared with earlier rounds: the survey changed</>;
    else if (cmp.kind === "not-usable") chg = <>Earlier figure not checked</>;

    const title = seriesTitle(s);
    const rows = ofKind(all, c.kind)
      .filter(showable)
      .sort((a, b) => b.period.localeCompare(a.period));
    const unit = unitLabel(latest.unit, latest.scale_factor);
    const key = s.series_id;
    items.push({
      key,
      name: c.name,
      head: (
        <>
          <h2 className="dash-title">{title}</h2>
          <p className="dash-fig">
            <span className="dash-big">
              <ShortValue o={latest} series={s} />
            </span>
            <span className="dash-when">
              {KIND_WORDS[latest.kind] ?? "Figure"}, {P(latest.period, s)}
              {chg ? (
                <>
                  <br />
                  {chg}
                </>
              ) : null}
            </span>
          </p>
        </>
      ),
      chart: <Chart model={buildChart(s)} idBase={`dash-${items.length}`} caption={title} options={{ height: 280 }} />,
      table: (
        <div className="dash-tbl-wrap">
          <table className="tbl4">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="num">
                  {KIND_WORDS[c.kind] ?? "Figure"}, {unit}
                </th>
                <th scope="col" className="num">
                  Change on the earlier figure
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const k = compare(s, o, all);
                return (
                  <tr key={o.obs_id}>
                    <th scope="row">{P(o.period, s)}</th>
                    <td className="num">
                      <V o={o} sheet className="v-link" />
                    </td>
                    <td className="num muted">{k.kind === "change" ? <DerivedValue d={k.derived} /> : "Not compared"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ),
      foot: (
        <>
          <p className="dash-src">
            Source: <SourceMarker o={latest} />
          </p>
          <p className="dash-links">
            <Link href={seriesHref(s.series_id)} className="strong">
              Open the full series
            </Link>
            <a href={seriesCsvHref(s.series_id)} download>
              Download CSV
            </a>
            <Link href={`/compare?s=${encodeURIComponent(s.series_id)}`}>Add to chart builder</Link>
            <Link href={`${seriesHref(s.series_id)}?tab=cite`}>Cite</Link>
          </p>
          <p className="src-hint">
            Click the headline figure, any point on the chart or any value in the table view to see where it was printed. <Link href="/methods">How we check</Link>
          </p>
        </>
      ),
      row: (
        <>
          <span className="dash-row-when">
            {KIND_WORDS[latest.kind] ?? "Figure"}, {P(latest.period, s)}
          </span>
          <span className="dash-row-spark">
            <Spark series={s} width={64} height={22} link={false} />
          </span>
          <span className="dash-row-v">
            <ShortValue o={latest} series={s} />
            {short ? <span className="dash-row-chg">{short}</span> : null}
          </span>
        </>
      ),
    });
  }
  if (!items.length) return null;
  return <Dashboard items={items} cycleSeconds={8} moreHref="/browse" />;
}

/* ============================== 4 today's rates ============================== */

export function RatesStrip() {
  const items = (daily.items as { id: string; name: string }[]).slice(0, 5);
  if (!items.length) return null;
  // isOn("dailyRates") cannot be true: lib/features.ts fails the build until a collector exists.
  return (
    <section className="rt4" aria-labelledby="rt4-h">
      <div className="rt4-head">
        <h2 id="rt4-h">Today&rsquo;s rates</h2>
        <span className="rt4-note">{isOn("dailyRates") ? "From official notifications" : "Not yet collected. They will come from official notifications, once a day."}</span>
      </div>
      <ul className="rt4-grid">
        {items.map((it) => (
          <li key={it.id}>
            <span className="rt4-name">{it.name}</span>
            <span className="rt4-none">Not yet collected</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* =============================== 5 insights =============================== */

export function Insights() {
  // Flag `insights` off: automated findings need a backend and a human review step first.
  return (
    <section className="h4-sec in4" aria-labelledby="in4-h">
      <Head id="in4-h">Insights from the data</Head>
      <div className="soon4">
        <p className="soon4-tag">Coming soon</p>
        <p>
          Short findings written from the latest figures in each release. Every sentence will link to the figures it uses, and a member of the DataLab team will review each one before it is shown.
        </p>
      </div>
    </section>
  );
}

/* ============================ 6 Pakistan at a glance ============================ */

const PROVS = [
  { code: "pb", iso: "PK-PB", name: "Punjab" },
  { code: "sd", iso: "PK-SD", name: "Sindh" },
  { code: "kp", iso: "PK-KP", name: "Khyber Pakhtunkhwa" },
  { code: "ba", iso: "PK-BA", name: "Balochistan" },
];
const GLANCE = [
  { key: "lf", measure: "labour_force", title: "Labour force" },
  { key: "emp", measure: "employed", title: "Employed persons" },
  { key: "lfpr", measure: "lfpr_refined", title: "Labour force participation rate" },
];
const GLANCE_SOON = ["Population", "Literacy rate", "Area", "Federal transfers"];

type GlanceRow = { key: string; title: string; series: Series; period: string; obs: Observation[] };

function glanceRows(): GlanceRow[] {
  const d = db();
  const rows: GlanceRow[] = [];
  for (const g of GLANCE) {
    const ids = [`lfs.${g.measure}.total.total`, ...PROVS.map((p) => `lfs.${g.measure}.${p.code}.total.total`)];
    const ss = ids.map((id) => d.seriesById.get(id));
    if (ss.some((s) => !s)) continue;
    // The latest period in which the country and all four provinces have a checked figure of the same kind.
    const per = (s: Series) => new Map((d.obsBySeries.get(s.series_id) ?? []).filter(usable).map((o) => [`${o.period}|${o.kind}`, o]));
    const maps = ss.map((s) => per(s!));
    const keys = [...maps[0].keys()].filter((k) => maps.every((m) => m.has(k))).sort();
    const k = keys.pop();
    if (!k) continue;
    rows.push({ key: g.key, title: g.title, series: ss[0]!, period: k.split("|")[0], obs: maps.map((m) => m.get(k)!) });
  }
  return rows;
}

/** Plain Mercator, fitted to the box. */
function mapPaths(w: number, h: number): { iso: string; name: string; d: string }[] {
  type F = { properties: { shapeISO: string; shapeName: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
  const feats = (geo as unknown as { features: F[] }).features;
  const rings = (f: F): number[][][] => (f.geometry.type === "MultiPolygon" ? (f.geometry.coordinates as number[][][][]).flat() : (f.geometry.coordinates as number[][][]));
  const proj = ([lon, lat]: number[]) => [lon, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI)];
  const pts = feats.flatMap((f) => rings(f).flat().map(proj));
  const x0 = Math.min(...pts.map((p) => p[0]));
  const x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1]));
  const y1 = Math.max(...pts.map((p) => p[1]));
  const k = Math.min((w - 8) / (x1 - x0), (h - 8) / (y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2;
  const oy = (h - (y1 - y0) * k) / 2;
  return feats.map((f) => ({
    iso: f.properties.shapeISO,
    name: f.properties.shapeName,
    d: rings(f)
      .map((r) =>
        r
          .map(proj)
          .map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - x0) * k).toFixed(1)} ${(oy + (y - y0) * k).toFixed(1)}`)
          .join("") + "Z",
      )
      .join(""),
  }));
}

export function AtAGlance() {
  const rows = glanceRows();
  const W = 340;
  const H = 380;
  const paths = mapPaths(W, H);
  // Shade class per row and province: rank among the four provinces, spread over five steps.
  const shade = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const vals = PROVS.map((p, i) => ({ iso: p.iso, v: Number(r.obs[i + 1].value) }));
    const sorted = [...vals].sort((a, b) => a.v - b.v);
    const m = new Map<string, number>();
    sorted.forEach((x, i) => m.set(x.iso, 1 + Math.round((i / Math.max(1, sorted.length - 1)) * 4)));
    shade.set(r.key, m);
  }
  const css = rows
    .flatMap((r) => [...(shade.get(r.key) ?? new Map()).entries()].map(([iso, q]) => `.gl-body[data-sel="${r.key}"] path[data-iso="${iso}"]{fill:var(--q${q})}`))
    .join("");
  const table = (
    <table className="tbl4 gl-tbl">
      <thead>
        <tr>
          <th scope="col">Indicator</th>
          <th scope="col" className="num gl-pk">
            Pakistan
          </th>
          {PROVS.map((p) => (
            <th key={p.code} scope="col" className="num">
              {p.name}
            </th>
          ))}
          <th scope="col" className="num">
            Islamabad
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-row={r.key}>
            <th scope="row">
              <Link href={seriesHref(r.series.series_id)} className="gl-name">
                {r.title}
              </Link>
              <span className="gl-src">
                {unitLabel(r.obs[0].unit, r.obs[0].scale_factor)}, Labour Force Survey {P(r.period, r.series)}
              </span>
            </th>
            {r.obs.map((o, i) => (
              <td key={o.obs_id} className={`num${i === 0 ? " gl-pk" : ""}`}>
                <V o={o} sheet className="v-link" />
              </td>
            ))}
            <td className="num gl-none">Not in the survey tables</td>
          </tr>
        ))}
        {GLANCE_SOON.map((t) => (
          <tr key={t} className="gl-soon">
            <th scope="row">
              <span className="gl-name">{t}</span>
            </th>
            <td colSpan={PROVS.length + 2} className="gl-none">
              Coming soon
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const map = (
    <svg viewBox={`0 0 ${W} ${H}`} className="gl-svg" role="img" aria-label="Map of Pakistan by province, shaded by the selected row. Provinces without a figure are hatched.">
      <defs>
        <pattern id="gl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--card)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule-strong)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <style>{css}</style>
      {paths.map((p) => (
        <path key={p.iso} d={p.d} data-iso={p.iso} className="gl-prov">
          <title>{p.name}</title>
        </path>
      ))}
    </svg>
  );
  return (
    <section className="h4-sec gl4" aria-labelledby="gl4-h">
      <Head id="gl4-h" note="The country and its provinces, side by side" more={<Link href="/topics/provinces">Every provincial figure</Link>}>
        Pakistan at a glance
      </Head>
      {rows.length ? <GlanceSelect rows={rows.map((r) => ({ key: r.key, title: r.title }))} table={table} map={map} /> : <p className="soon4">Coming soon</p>}
    </section>
  );
}

/* ================================ 7 data by topic ================================ */

const SOON_TOPICS = ["National accounts", "Trade", "Money and banking", "Census and population", "Households", "Energy", "Agriculture"];

export function TopicGrid() {
  const list = topics();
  return (
    <section className="h4-sec tp4" aria-labelledby="tp4-h">
      <Head id="tp4-h" more={<Link href="/browse">Indicators A to Z</Link>}>
        Data by topic
      </Head>
      <ul className="tp4-grid">
        {list.map((t) => {
          const series = t.groups.flatMap((g) => g.series);
          const latest = series
            .flatMap((s) => (db().obsBySeries.get(s.series_id) ?? []).filter(showable).map((o) => ({ o, s })))
            .sort((a, b) => a.o.period.localeCompare(b.o.period))
            .pop();
          return (
            <li key={t.slug}>
              <Link href={topicHref(t.slug)} className="tp4-name">
                {t.name}
              </Link>
              <ul className="tp4-items">
                {series.slice(0, 3).map((s) => (
                  <li key={s.series_id}>
                    <Link href={seriesHref(s.series_id)}>{seriesTitle(s)}</Link>
                  </li>
                ))}
              </ul>
              {latest ? <span className="tp4-meta">Latest figure: {P(latest.o.period, latest.s)}</span> : null}
            </li>
          );
        })}
        {SOON_TOPICS.slice(0, Math.max(0, 12 - list.length)).map((n) => (
          <li key={n} className="tp4-soon">
            <span className="tp4-name">{n}</span>
            <span className="tp4-meta">Coming soon</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ========================== 8 latest releases, coming up ========================== */

type CalEntry = { id: string; name: string; agency: string; when: string; status: "expected" | "announced" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ReleasesRow() {
  const added = dateOnly(db().release.created_at);
  const docs = library()
    .documents.filter((d) => d.state === "read")
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 6);
  const freq = (d: { period: string; kind: string }) => ({ frequency: /^\d{4}-(0[1-9]|1[0-2])$/.test(d.period) ? "month" : "" });
  const entries = (calendar.entries as CalEntry[]).slice().sort((a, b) => a.when.localeCompare(b.when));
  return (
    <section className="h4-sec rl4" aria-label="Latest releases and coming up">
      <div className="rl4-main">
        <Head id="rl4-h" more={<Link href="/releases">All releases</Link>}>
          Latest releases
        </Head>
        <div className="tbl4-scroll">
          <table className="tbl4 rl4-tbl" aria-labelledby="rl4-h">
            <thead>
              <tr>
                <th scope="col">Added</th>
                <th scope="col">Publication</th>
                <th scope="col">Published by</th>
                <th scope="col" className="num">
                  Download
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="muted nowrap">
                    <Num kind="date">{added}</Num>
                  </td>
                  <td>
                    <span className="rl4-pub">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/cover-blank.png" alt="" width={44} height={60} className="rl4-cover" />
                      <Link href={sourceHref(d.id)}>
                        {d.kindName} {P(d.period, freq(d))}
                      </Link>
                    </span>
                  </td>
                  <td className="muted">{d.publisher}</td>
                  <td className="num">
                    {d.file ? (
                      <a href={d.file.href} download>
                        PDF
                      </a>
                    ) : d.officialUrl ? (
                      <a href={d.officialUrl}>Official page</a>
                    ) : (
                      <span className="muted">Not available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rl4-side">
        <Head id="cu4-h" more={<Link href="/calendar">Calendar</Link>}>
          Coming up
        </Head>
        {entries.length ? (
          <ul className="cu4-list" aria-labelledby="cu4-h">
            {entries.map((e) => {
              const [y, m, day] = e.when.split("-");
              return (
                <li key={e.id} data-cal-entry={e.id}>
                  <span className="cu4-date" aria-hidden="true">
                    <span className="cu4-mon">{MON[Number(m) - 1]}</span>
                    <span className="cu4-day">
                      <span data-num="ui">{e.status === "announced" && day ? String(Number(day)) : y}</span>
                    </span>
                  </span>
                  <span>
                    {e.name}
                    <br />
                    <span className="cu4-when">
                      {e.agency} · {e.status === "announced" ? "Announced for " : "Expected "}
                      <span data-num={e.status === "announced" ? "date" : "ui"} data-cal={e.id}>
                        {e.status === "announced" ? e.when : periodWords(e.when, "month")}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No dates are expected yet.</p>
        )}
        <div className="al4">
          <p className="al4-h">Get release alerts</p>
          <p>One email when a publication you follow is added. Coming soon: until then, the release calendar lists what is expected.</p>
        </div>
      </div>
    </section>
  );
}

/* ============================ 9 calculator and tools ============================ */

const CPI_INDEX = "cpi.national.general.b2015_16";

export function ToolsBand() {
  const s = db().seriesById.get(CPI_INDEX);
  const points = s
    ? (db().obsBySeries.get(s.series_id) ?? [])
        .filter((o) => usable(o) && o.period.slice(5) === "06")
        .sort((a, b) => a.period.localeCompare(b.period))
    : [];
  const ok = !!s && points.length >= 2;
  const calcPoints: CalcPoint[] = points.map((o) => ({ key: o.obs_id, label: periodWords(o.period, s!.frequency), value: o.value! }));
  const slots: Record<string, CalcSlot> = {};
  for (const o of points) slots[o.obs_id] = { idx: <V o={o} sheet className="v-link" />, page: <PageRef o={o} doc={false} /> };
  return (
    <section className="tb4" aria-label="Tools">
      <div className="wrap tb4-in">
        <div className="tb4-calc ic">
          <h2>Inflation calculator</h2>
          <p className="tb4-lead">What a rupee amount from an earlier year is worth in a later one, worked out from the consumer price index.</p>
          {ok ? (
            <InflationCalc points={calcPoints} slots={slots} defaultAmount="100000" defaultFrom={points[0].obs_id} defaultTo={points[points.length - 1].obs_id} />
          ) : (
            <p>Coming soon: the release does not yet hold two checked values of the price index.</p>
          )}
          <p className="tb4-note">
            June of each year only, the one month this release holds for every year. <Link href="/inflation-calculator">See the index values and their pages</Link>
          </p>
        </div>
        <div className="tb4-more">
          <h2>More tools</h2>
          <ul>
            <li>
              <Link href="/compare">Chart builder</Link>
              <span>Put up to six series on one chart.</span>
            </li>
            <li>
              <Link href="/compare/education">Compare provinces</Link>
              <span>One indicator across the country, side by side.</span>
            </li>
            <li>
              <Link href="/topics/spending">Where the federal budget goes</Link>
              <span>Federal spending by function.</span>
            </li>
            <li>
              <Link href="/data">Bulk download</Link>
              <span>Every dataset as CSV or Excel, with a citation. A query API is coming.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ============================ 10 where the figures come from ============================ */

export function Publishers() {
  const pubs = publisherSeries();
  const plain = new Map(library().documents.map((d) => [d.publisherFull, d.publisher]));
  const list = [...pubs.entries()].sort((a, b) => b[1].size - a[1].size);
  if (!list.length) return null;
  return (
    <section className="h4-sec pb4" aria-labelledby="pb4-h">
      <Head id="pb4-h" more={<Link href="/library">The documents</Link>}>
        Where the figures come from
      </Head>
      <ul className="pb4-grid">
        {list.map(([raw, set]) => (
          <li key={raw}>
            <Link href={`/library?publisher=${encodeURIComponent(plain.get(raw) ?? raw)}`}>{plain.get(raw) ?? raw}</Link>
            <span className="muted">
              <span data-num="derived" data-derived="publisher-series" data-publisher={raw}>
                {set.size.toLocaleString("en-US")}
              </span>{" "}
              series
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
