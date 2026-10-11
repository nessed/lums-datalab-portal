// Every observation of a series, one row each: period, estimate type, value,
// status, and where it is printed. Gaps are rows too, with their reason.
// Values are plain when checked (the legend says so); anything else carries
// its status shape and a patterned cell, so the table reads in greyscale.
import Link from "next/link";
import { TableWrap } from "@/components/ui/Basics";
import { StatusBadge, cellFillClass } from "@/components/ui/Status";
import SortToggle from "@/components/SortToggle";
import { db, obsHref, sourceHref, type Series } from "@/lib/data";
import { formatDecimalString, periodWords, unitLabel, vintageWords } from "@/lib/format";
import { statusOf } from "@/lib/status";

export default function SeriesTable({ series, id = "data" }: { series: Series; id?: string }) {
  const d = db();
  const all = [...(d.obsBySeries.get(series.series_id) ?? [])].sort((a, b) => a.period.localeCompare(b.period) || a.vintage.localeCompare(b.vintage));
  const unit = unitLabel(series.unit, series.scale_factor);
  const multiVintage = new Set(all.map((o) => o.vintage)).size > 1 || all.some((o) => o.vintage !== "na");
  const breakAt = new Map(series.breaks.map((b) => [b.at_period, b]));
  const tbodyId = `${id}-rows`;
  const firstOfPeriod = new Set(all.filter((o, i) => i === 0 || all[i - 1].period !== o.period).map((o) => o.obs_id));

  return (
    <>
      <div className="table-tools">
        <span className="small muted">
          {all.length} {all.length === 1 ? "row" : "rows"}. Values in {unit}. A plain number is checked; anything else says why there is no number.
        </span>
        <SortToggle target={tbodyId} />
      </div>
      <TableWrap label={`Every figure of ${series.name}`} sticky tall={all.length > 30}>
        <table className="obs-table">
          <caption className="sr-only">
            {series.name}: every figure in this release, {unit}, with its status and where it is printed.
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {multiVintage ? <th scope="col">Kind of figure</th> : null}
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col">Status</th>
              <th scope="col">Printed in</th>
            </tr>
          </thead>
          <tbody id={tbodyId}>
            {all.map((o) => {
              const info = statusOf(o);
              const cell = o.primary_cell_id ? d.cellById.get(o.primary_cell_id) : undefined;
              const src = cell ? d.sourceById.get(cell.source_id) : undefined;
              const br = firstOfPeriod.has(o.obs_id) ? breakAt.get(o.period) : undefined;
              const isValue = info.key === "checked";
              return (
                <tr key={o.obs_id} className={br ? "row-break" : undefined}>
                  <th scope="row">
                    {periodWords(o.period, series.frequency)}
                    {br ? <span className="break-tag">Series break: {br.kind.replaceAll("_", " ")}</span> : null}
                  </th>
                  {multiVintage ? (
                    <td>
                      <span className="w-long">{vintageWords(o.vintage)}</span>
                      <span className="w-short" aria-hidden="true">
                        {vintageWords(o.vintage).split(" ")[0]}
                      </span>
                    </td>
                  ) : null}
                  <td className={`num ${cellFillClass(info.key)}`}>
                    {isValue ? (
                      <Link href={obsHref(o.obs_id)} className="v-link">
                        {formatDecimalString(o.value)}
                      </Link>
                    ) : (
                      <Link href={obsHref(o.obs_id)} className="gap-link" aria-label={`${info.label}: open the receipt`}>
                        <span aria-hidden="true">no value</span>
                      </Link>
                    )}
                  </td>
                  <td className="status-cell">
                    {isValue ? (
                      <span className="muted small checked-word">Checked</span>
                    ) : (
                      <>
                        <StatusBadge info={info} />
                        {o.gap_reason ? <span className="gap-reason">{o.gap_reason}</span> : null}
                      </>
                    )}
                  </td>
                  <td className="small">
                    {src && cell && (isValue || info.key === "gap-source" || info.key === "disputed") ? (
                      <>
                        <Link href={sourceHref(src.source_id)}>{src.title}</Link>, p.&nbsp;{cell.page}
                      </>
                    ) : (
                      <span className="muted">not shown for this status</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
