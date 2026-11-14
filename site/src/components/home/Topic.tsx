// Pieces of a topic page (DESIGN.md 9.3): the series as a short tree with a
// sparkline and latest value per row, the documents that feed the topic, and
// for budget topics how much budget estimates change (8.2).
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import Spark from "@/components/Spark";
import { Num } from "@/components/ui/Num";
import { db, seriesHref, sourceHref, type Series, type Source } from "@/lib/data";
import { DOC_TYPE_WORDS } from "@/lib/format";
import { DerivedInline, DerivedNotes, kindPeriod, PageWords, ShortValue } from "./Bits";
import { latestShown, revisionPairs, revisionStats } from "./derive";
import type { TopicGroup } from "./editorial";

/** The kind a series is read on in a topic: budget estimate if it has one, else whatever its figures are. */
export function mainKind(s: Series): string {
  const all = db().obsBySeries.get(s.series_id) ?? [];
  if (all.some((o) => o.kind === "be")) return "be";
  return all[0]?.kind ?? "as_printed";
}

export function seriesRow(s: Series, words: PageWords): ReactNode {
  const all = db().obsBySeries.get(s.series_id) ?? [];
  const { latest } = latestShown(all, mainKind(s));
  const d = db();
  const parent = s.parent_id ? d.seriesById.get(s.parent_id) : undefined;
  return (
    <li key={s.series_id} className="st-row">
      <span className="st-name">
        <Link href={seriesHref(s.series_id)}>{s.name}</Link>
        {parent ? <span className="st-parent small muted"> part of {parent.name}</span> : null}
      </span>
      <span className="st-spark" aria-hidden="true">
        <Spark series={s} width={88} height={26} link={false} />
      </span>
      <span className="st-latest">
        {latest ? (
          <>
            <ShortValue o={latest} series={s} />
            <span className="st-kind small muted">{kindPeriod(latest, s, words)}</span>
          </>
        ) : (
          <span className="small muted">No checked figure</span>
        )}
      </span>
    </li>
  );
}

export function seriesTree(groups: TopicGroup[], words: PageWords): ReactNode {
  return groups.map((g) => (
    <section key={g.heading} className="st-group" aria-label={g.heading}>
      <h3>{g.heading}</h3>
      <ul className="st-list">{g.series.map((s) => seriesRow(s, words))}</ul>
    </section>
  ));
}

/** The documents behind the checked figures of these series, newest first within each kind. */
export function topicSources(series: Series[]): { type: string; list: Source[] }[] {
  const d = db();
  const ids = new Set<string>();
  for (const s of series)
    for (const o of d.obsBySeries.get(s.series_id) ?? []) {
      if (!o.published || !o.primary_cell_id) continue;
      const c = d.cellById.get(o.primary_cell_id);
      if (c) ids.add(c.source_id);
    }
  const byType = new Map<string, Source[]>();
  for (const id of ids) {
    const src = d.sourceById.get(id);
    if (!src) continue;
    byType.set(src.doc_type, [...(byType.get(src.doc_type) ?? []), src]);
  }
  return [...byType.entries()].map(([type, list]) => ({ type, list: list.sort((a, b) => b.period.localeCompare(a.period)) }));
}

export function SourcesList({ series }: { series: Series[] }) {
  return (
    <>
      {topicSources(series).map(({ type, list }) => (
        <div key={type} className="tp-src">
          <h3>{DOC_TYPE_WORDS[type] ?? type}</h3>
          <ul className="tp-src-list">
            {list.map((s) => (
              <li key={s.source_id}>
                <Link href={sourceHref(s.source_id)}>
                  <Num kind="text">{s.title}</Num>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** How much budget estimates change, by line (DESIGN.md 8.2): average and average absolute revision from budget to revised estimate. */
export function revisionTable(series: Series[], words: PageWords, notes: DerivedNotes): ReactNode {
  const rows = series
    .map((s) => {
      const pairs = revisionPairs(db().obsBySeries.get(s.series_id) ?? []);
      const st = revisionStats(pairs);
      return st ? { s, st } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (rows.length === 0) return <p>No line has a checked budget estimate and a checked revised estimate for the same year in this release.</p>;
  const be = words.kind("be");
  const re = words.kind("re");
  return (
    <>
      <p className="measure">
        For each line: the years in this release with both a checked {be} and a checked {re} for the same year, and by how much the {re} differed
        from the {be} on average. The average absolute change ignores whether it went up or down, so changes in opposite directions do not cancel out.
        Figures that did not pass their checks are left out.
      </p>
      <div className="table-wrap" role="region" aria-label="Revisions from budget to revised estimate" tabIndex={0}>
        <table className="rev-table">
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col" className="num">
                Years compared
              </th>
              <th scope="col" className="num">
                Average change, BE to RE (per cent)
              </th>
              <th scope="col" className="num">
                Average absolute change (per cent)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, st }) => {
              // One note per line: the average change, its formula and every pair it used; the other two columns come from the same pairs.
              const a = notes.add(st.mean, `${s.name}: average change from budget to revised estimate (the average absolute change and the number of years in the same row use the same pairs)`);
              const b = a;
              const c = a;
              return (
                <tr key={s.series_id}>
                  <th scope="row">
                    <Link href={seriesHref(s.series_id)}>{s.name}</Link>
                  </th>
                  <td className="num">
                    <DerivedInline d={st.n} id={a} />
                  </td>
                  <td className="num">
                    <DerivedInline d={st.mean} id={b} />
                  </td>
                  <td className="num">
                    <DerivedInline d={st.meanAbs} id={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
