// A checked figure in one line: value (linked to its receipt), unit, and the
// kind of figure with its period ("budget estimate 2026-27"). Used by the home
// headline strip, the catalogue's "Latest" column and related-series lists.
import { StatusMark } from "@/components/ui/Status";
import { Num, V } from "@/components/ui/Num";
import type { Observation, Series } from "@/lib/data";
import { periodWords, unitLabel, vintageWords } from "@/lib/format";

/** "budget estimate" / "revised estimate" / "" for figures with no stage. */
export function kindWords(vintage: string): string {
  return vintage === "na" ? "" : vintageWords(vintage).toLowerCase();
}

const FREQ_PREFIX: Record<string, string> = { survey_round: "survey round " };

/** The period with the kind of figure in front: "budget estimate 2026-27", "June 2026", "survey round 2024-25". */
export function KindAndPeriod({ o, series, short }: { o: Pick<Observation, "vintage" | "period">; series: Pick<Series, "frequency">; short?: boolean }) {
  const k = kindWords(o.vintage);
  const prefix = k ? (short ? `${o.vintage.toUpperCase()} ` : `${k} `) : short ? "" : (FREQ_PREFIX[series.frequency] ?? "");
  return (
    <>
      {prefix}
      <Num kind="period">{periodWords(o.period, series.frequency)}</Num>
    </>
  );
}

export function FigureLine({ o, series, unit = true }: { o: Observation; series: Series; unit?: boolean }) {
  return (
    <span className="fig-line">
      <span className="fig-v">
        <StatusMark k="checked" />
        <span className="sr-only">Checked: </span>
        <V o={o} />
      </span>
      {unit ? <span className="fig-u">{unitLabel(series.unit, series.scale_factor)}</span> : null}
    </span>
  );
}
