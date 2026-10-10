// Chart + table + CSV link for one series. Server component.
import Link from "next/link";
import Chart from "@/components/Chart";
import { GapBadge, StatusBadge } from "@/components/Badges";
import { buildChart } from "@/lib/chart";
import { db, obsHref, seriesCsvHref, type Observation, type Series } from "@/lib/data";
import { formatDecimalString, unitLabel, vintageWords } from "@/lib/format";

export function ValueCell({ obs }: { obs: Observation | undefined }) {
  if (!obs) return <span className="muted small">No such figure in this release</span>;
  if (obs.published && obs.value !== null) {
    return (
      <span className="cell-stack">
        <Link href={obsHref(obs.obs_id)} className="value" title="Open the receipt: where this figure is printed and how it was checked">
          {formatDecimalString(obs.value)}
        </Link>
        <StatusBadge status={obs.status} />
      </span>
    );
  }
  return (
    <span className="cell-stack">
      <GapBadge kind={obs.gap_kind} />
      <Link href={obsHref(obs.obs_id)} className="small">
        Why?
      </Link>
    </span>
  );
}

export default function SeriesView({ series }: { series: Series }) {
  const all = db().obsBySeries.get(series.series_id) ?? [];
  const periods = [...new Set(all.map((o) => o.period))].sort();
  const vintages = [...new Set(all.map((o) => o.vintage))].sort();
  const byKey = new Map(all.map((o) => [`${o.period}|${o.vintage}`, o]));
  const unit = unitLabel(series.unit, series.scale_factor);
  const breakAt = new Map(series.breaks.map((b) => [b.at_period, b]));
  const published = all.filter((o) => o.published).length;

  return (
    <section>
      <Chart model={buildChart(series)} caption={`${series.name}, ${unit}.`} />
      <div className="actions">
        <a className="button" href={seriesCsvHref(series.series_id)} download>
          Download CSV (with provenance columns)
        </a>
        <span className="small">
          {published} checked {published === 1 ? "value" : "values"}, {all.length - published} labelled {all.length - published === 1 ? "gap" : "gaps"}.
          Unit: {unit}.
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            {series.name}, {unit}, by period
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {vintages.map((v) => (
                <th scope="col" key={v}>
                  {vintages.length === 1 && v === "na" ? `Value (${unit})` : `${vintageWords(v)} (${unit})`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const br = breakAt.get(p);
              return (
                <tr key={p}>
                  <th scope="row">
                    {p}
                    {br && (
                      <div className="small muted" style={{ fontWeight: 400, whiteSpace: "normal", maxWidth: "12rem" }} title={br.note}>
                        Break from this period: {br.kind.replaceAll("_", " ")}
                      </div>
                    )}
                  </th>
                  {vintages.map((v) => (
                    <td key={v}>
                      <ValueCell obs={byKey.get(`${p}|${v}`)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
