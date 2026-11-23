// Home v3 pages set (design handoff, 2026-11-24): the parts of the series page
// that the Indicator and Budget line screens add. Server components. Every
// figure is a <V> from the release; the one new derived figure (a revised
// estimate against the budget estimate of the same year) is a pct change that
// scripts/checks/home-derived.mjs recomputes and claims. Gaps are words.
import Link from "@/components/ui/Link";
import Spark from "@/components/Spark";
import CopyButton from "@/components/ui/CopyButton";
import { Num, V } from "@/components/ui/Num";
import { DerivedValue } from "@/components/home/Bits";
import { change, ofKind, showable } from "@/components/home/derive";
import { topics } from "@/components/home/editorial";
import { cite } from "@/lib/cite";
import { db, seriesCsvHref, seriesHref, type Observation, type Series } from "@/lib/data";
import { isOn } from "@/lib/features";
import { periodWords, unitLabel } from "@/lib/format";
import { ancestors } from "@/lib/stats";
import { seriesTitle } from "@/lib/titles";

const P = (p: string, s: Pick<Series, "frequency">) => <Num kind="period">{periodWords(p, s.frequency)}</Num>;
const latestOf = (id: string): Observation | undefined =>
  (db().obsBySeries.get(id) ?? [])
    .filter(showable)
    .sort((a, b) => a.period.localeCompare(b.period))
    .pop();

/* ---------------- header actions ---------------- */

export function IndicatorActions({ series, path }: { series: Series; path: string }) {
  return (
    <div className="ix-actions">
      <a className="ix-btn ix-btn-primary" href={seriesCsvHref(series.series_id)} download>
        Download data
      </a>
      <Link className="ix-btn" href={`${path}?tab=cite#cite`}>
        Cite
      </Link>
      <Link className="ix-btn" href={`/compare?s=${encodeURIComponent(series.series_id)}`}>
        Add to chart builder
      </Link>
      {isOn("releaseAlerts") ? null : (
        <span className="ix-btn ix-btn-off" aria-disabled="true" title="Release alerts are coming soon">
          Get alerts <span className="ix-soon">Coming soon</span>
        </span>
      )}
    </div>
  );
}

/* ---------------- budget line: Show as ---------------- */

/** Rupees only: the other views need a checked deflator, GDP or population series in the release. */
export function ShowAs({ series }: { series: Series }) {
  if (series.unit !== "PKR") return null;
  const modes: { label: string; on: boolean }[] = [
    { label: "Real terms", on: isOn("realTerms") },
    { label: "% of GDP", on: isOn("percentOfGdp") },
    { label: "Per person", on: isOn("perPerson") },
  ];
  return (
    <div className="ix-showas">
      <p className="ix-showas-h" id="ix-showas-h">
        Show as
      </p>
      <div role="group" aria-labelledby="ix-showas-h" className="ix-seg">
        <button type="button" aria-pressed="true">
          Rupees
        </button>
        {modes.map((m) => (
          <button key={m.label} type="button" disabled aria-pressed="false" title={`${m.label}: coming soon`}>
            {m.label} <span className="ix-soon">Coming soon</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Also show ---------------- */

/** Related lines the release holds (CPI national: towns, villages, food). Each opens the chart builder with both series. */
export function AlsoShow({ series }: { series: Series }) {
  const m = /^cpi\.national\.yoy\.general$/.exec(series.series_id);
  if (!m) return null;
  const extra = ["cpi.urban.yoy.general", "cpi.rural.yoy.general", "cpi.national.yoy.group.food"].map((id) => db().seriesById.get(id)).filter((s): s is Series => !!s && !!latestOf(s.series_id));
  if (!extra.length) return null;
  return (
    <p className="ix-also">
      <span className="ix-also-h">Also show</span>
      {extra.map((s) => (
        <Link key={s.series_id} className="ix-chip" href={`/compare?s=${encodeURIComponent([series.series_id, s.series_id].join(","))}`}>
          {seriesTitle(s)}
        </Link>
      ))}
      <span className="ix-also-note">opens both on one chart</span>
    </p>
  );
}

/* ---------------- By group of goods ---------------- */

export function GroupsTable({ series }: { series: Series }) {
  if (series.series_id !== "cpi.national.yoy.general" && series.series_id !== "cpi.national.general.b2015_16") return null;
  const d = db();
  const groups = d.series.filter((s) => s.series_id.startsWith("cpi.national.yoy.group.") && latestOf(s.series_id));
  if (!groups.length) return null;
  const rows = groups.map((g) => {
    const slug = g.series_id.slice("cpi.national.yoy.group.".length);
    const w = latestOf(`cpi.national.weight.${slug}.b2015_16`);
    const c = latestOf(g.series_id)!;
    return { g, w, c };
  });
  const top = Math.max(...rows.map((r) => Math.abs(Number(r.c.value))), 0.0001);
  const when = rows[0].c;
  return (
    <section className="ix-sec" aria-labelledby="ix-grp-h">
      <div className="ix-sec-head">
        <h2 id="ix-grp-h">By group of goods, {P(when.period, rows[0].g)}</h2>
        <Link href="/topics/prices">Every price series</Link>
      </div>
      <div className="tbl4-scroll">
        <table className="tbl4 ix-grp">
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col" className="num">
                Share of basket, per cent
              </th>
              <th scope="col">Change on a year earlier, per cent</th>
              <th scope="col" className="num">
                Over time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ g, w, c }) => {
              const v = Number(c.value);
              const pct = (Math.abs(v) / top) * 50;
              return (
                <tr key={g.series_id}>
                  <th scope="row">
                    <Link href={seriesHref(g.series_id)}>{seriesTitle(g)}</Link>
                  </th>
                  <td className="num muted">{w ? <V o={w} sheet className="v-link" /> : "Not printed"}</td>
                  <td>
                    <span className="ix-barcell">
                      <span className="ix-bar" aria-hidden="true">
                        <span className="ix-bar-mid" />
                        <span className={`ix-bar-fill${v < 0 ? " is-neg" : ""}`} style={v < 0 ? { right: "50%", width: `${pct}%` } : { left: "50%", width: `${pct}%` }} />
                      </span>
                      <V o={c} sheet className="v-link" />
                    </span>
                  </td>
                  <td className="num">
                    <Spark series={g} width={72} height={20} link={false} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="src-hint">Each value opens the printed page with its own row boxed.</p>
    </section>
  );
}

/* ---------------- Planned against actual ---------------- */

export function PlannedActual({ series }: { series: Series }) {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const be = new Map(ofKind(all, "be").filter(showable).map((o) => [o.period, o]));
  const re = new Map(ofKind(all, "re").filter(showable).map((o) => [o.period, o]));
  const ac = new Map([...ofKind(all, "actual"), ...ofKind(all, "ac")].filter(showable).map((o) => [o.period, o]));
  const years = [...new Set([...be.keys(), ...re.keys(), ...ac.keys()])].sort().reverse();
  if (!years.length || !be.size) return null;
  const unit = unitLabel(series.unit, series.scale_factor);
  const ds = years.map((y) => change(be.get(y), re.get(y), "signed"));
  const top = Math.max(...ds.map((x) => (x ? Math.abs(Number(x.text.replace(/[^\d.]/g, ""))) : 0)), 0.0001);
  const missing = (y: string, k: "re" | "ac") => {
    if (k === "ac") return isOn("actualSpending") ? "Not yet published" : "Not yet collected";
    const last = [...be.keys()].sort().pop();
    return y === last ? "Not yet printed" : "Not in this release";
  };
  return (
    <section className="ix-sec" aria-labelledby="ix-pva-h">
      <h2 id="ix-pva-h">Planned against actual</h2>
      <p className="ix-lead">
        Each year&rsquo;s revised estimate is set against that year&rsquo;s budget estimate, never joined into one line. What was actually spent comes from the federal accounts, which are not yet collected.
      </p>
      <div className="tbl4-scroll">
        <table className="tbl4 ix-pva">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="num">
                Budgeted, {unit}
              </th>
              <th scope="col" className="num">
                Revised, {unit}
              </th>
              <th scope="col" className="num">
                Actual, {unit}
              </th>
              <th scope="col">Revised against budget</th>
              <th scope="col">Actual against budget</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y, i) => {
              const b = be.get(y);
              const r = re.get(y);
              const a = ac.get(y);
              const dv = ds[i];
              const mag = dv ? Number(dv.text.replace(/[^\d.]/g, "")) : 0;
              const neg = !!dv && /^[−-]/.test(dv.text);
              return (
                <tr key={y}>
                  <th scope="row">{P(y, series)}</th>
                  <td className="num">{b ? <V o={b} sheet className="v-link" /> : <span className="muted">Not in this release</span>}</td>
                  <td className="num">{r ? <V o={r} sheet className="v-link" /> : <span className="muted">{missing(y, "re")}</span>}</td>
                  <td className="num">{a ? <V o={a} sheet className="v-link" /> : <span className="muted">{missing(y, "ac")}</span>}</td>
                  <td>
                    {dv ? (
                      <span className="ix-barcell">
                        <span className="ix-bar" aria-hidden="true">
                          <span className="ix-bar-mid" />
                          <span className={`ix-bar-fill${neg ? " is-neg" : ""}`} style={neg ? { right: "50%", width: `${(mag / top) * 50}%` } : { left: "50%", width: `${(mag / top) * 50}%` }} />
                        </span>
                        <DerivedValue d={dv} />
                      </span>
                    ) : (
                      <span className="muted">Not compared</span>
                    )}
                  </td>
                  <td className="muted">{a && b ? "Not compared yet" : isOn("actualSpending") ? "Not yet published" : "Not yet collected"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ix-foot">Budgeted and revised figures are from the Annual Budget Statement of each year. The revised-against-budget column is worked out by us from the two printed figures in the same row, in per cent of the budget estimate.</p>
    </section>
  );
}

/* ---------------- Notes on this series ---------------- */

export function SeriesNotes({ series }: { series: Series }) {
  const ids = [series.series_id, ...ancestors(series).map((p) => p.series_id)];
  const t = topics().find((t) => t.groups.some((g) => g.series.some((s) => ids.includes(s.series_id))) || t.headline.some((s) => ids.includes(s.series_id)));
  const notes = t ? [...t.limits, ...t.gaps] : [];
  if (!notes.length) return null;
  return (
    <section className="ix-sec" aria-labelledby="ix-notes-h">
      <h2 id="ix-notes-h">Notes on this series</h2>
      <ul className="ix-notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- side: cite ---------------- */

export function CiteBox({ series, path }: { series: Series; path: string }) {
  const c = cite({ release: db().release, path, what: `Series ${series.series_id}, ${series.name}` });
  return (
    <section className="ix-cite" aria-labelledby="ix-cite-h">
      <h2 id="ix-cite-h" className="ix-side-h">
        Cite this series
      </h2>
      <p>
        <Num kind="cite">{c.sentence}</Num>
      </p>
      <CopyButton text={c.sentence} label="Copy citation" className="ix-copy" origin />
      <p className="ix-cite-more">
        <Link href={`${path}?tab=cite#cite`}>Other formats</Link>
      </p>
    </section>
  );
}
