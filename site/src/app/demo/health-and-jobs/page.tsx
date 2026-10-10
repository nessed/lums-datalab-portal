import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Chart from "@/components/Chart";
import Cite from "@/components/Cite";
import { buildChart } from "@/lib/chart";
import { datasetName, db, isDatasetPublished, obsHref, publishedObs, seriesHref, visibleSeries, type Observation, type Series } from "@/lib/data";
import { CHECKED_HELP, formatDecimalString, unitLabel, vintageWords } from "@/lib/format";

export const metadata: Metadata = { title: "Demo: health and jobs" };

/* ------------------------------------------------------------------------
 * DEMO CONFIG. The only place where this page decides which series to show.
 * A series matches a slot when it belongs to `dataset`, its id contains every
 * string in `include`, at least one string in `anyOf` (if given), and none in
 * `exclude`. If several match, ids containing a `prefer` string win, then the
 * shortest id. Adjust here if the final release names series differently.
 * ---------------------------------------------------------------------- */
type Slot = { dataset: string; include?: string[]; anyOf?: string[]; exclude?: string[]; prefer?: string[]; heading: string; lead: string };

const DEMO: Record<"health" | "healthShare" | "cpi" | "unemployment" | "participation", Slot> = {
  health: {
    dataset: "abs",
    include: ["function.health"],
    exclude: [".share"],
    heading: "Federal current spending on health",
    lead: "Budget estimates and revised estimates as printed in the federal Annual Budget Statement.",
  },
  healthShare: {
    dataset: "abs",
    include: ["function.health", ".share_of_total"],
    heading: "Health as a share of total federal expenditure",
    lead: "Computed by code from two checked figures in the same column of the same document.",
  },
  cpi: {
    dataset: "cpi",
    include: ["cpi.national.general.b2015_16"],
    heading: "Consumer prices: national general index (base 2015-16)",
    lead: "The national general Consumer Price Index for June and May of each issue, as printed in the Pakistan Bureau of Statistics Monthly Review of Price Indices. Only issues on the 2015-16 base are in this release.",
  },
  unemployment: {
    dataset: "lfs",
    include: ["unemployment_rate"],
    prefer: ["total.total"],
    heading: "Unemployment rate",
    lead: "As printed in the Labour Force Survey annual reports.",
  },
  participation: {
    dataset: "lfs",
    anyOf: ["lfpr", "participation"],
    prefer: ["total.total"],
    heading: "Labour force participation rate",
    lead: "As printed in the Labour Force Survey annual reports.",
  },
};
/* ---------------------------------------------------------------------- */

function pick(slot: Slot): Series | undefined {
  if (!isDatasetPublished(slot.dataset)) return undefined;
  const matches = visibleSeries().filter(
    (s) =>
      s.dataset === slot.dataset &&
      (slot.include ?? []).every((x) => s.series_id.includes(x)) &&
      (!slot.anyOf || slot.anyOf.some((x) => s.series_id.includes(x))) &&
      !(slot.exclude ?? []).some((x) => s.series_id.includes(x)),
  );
  const score = (s: Series) => ((slot.prefer ?? []).some((x) => s.series_id.includes(x)) ? 0 : 1);
  matches.sort((a, b) => score(a) - score(b) || a.series_id.length - b.series_id.length || a.sort_key - b.sort_key);
  return matches[0];
}

/** A number from the release, shown with its unit and linked to its receipt. */
function Fig({ obs }: { obs: Observation }) {
  return (
    <Link href={obsHref(obs.obs_id)} className="value" title="Open the receipt for this figure">
      {formatDecimalString(obs.value)}
    </Link>
  );
}

function mainVintage(obs: Observation[]): Observation[] {
  const counts = new Map<string, number>();
  for (const o of obs) counts.set(o.vintage, (counts.get(o.vintage) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return obs.filter((o) => o.vintage === best).sort((a, b) => a.period.localeCompare(b.period));
}

function ChartBlock({ slot, series }: { slot: Slot; series: Series | undefined }) {
  const hasValues = series ? publishedObs(series.series_id).length > 0 : false;
  if (!series || !hasValues) {
    const published = isDatasetPublished(slot.dataset);
    return (
      <div className="card card-coming" style={{ marginBottom: 18 }}>
        <h3>
          {slot.heading} <span className="badge badge-gap-pending">Coming</span>
        </h3>
        <p className="small">
          {published
            ? `No checked values for this series are in this release yet.`
            : `${datasetName(slot.dataset)} is not published in this release yet, so there is nothing to chart. No values are shown rather than unverified ones.`}
        </p>
      </div>
    );
  }
  return (
    <section>
      <h3>
        <Link href={seriesHref(series.series_id)}>{slot.heading}</Link>
      </h3>
      <p className="small">{slot.lead}</p>
      <Chart model={buildChart(series)} caption={`${series.name}, ${unitLabel(series.unit, series.scale_factor)}.`} />
    </section>
  );
}

export default function DemoPage() {
  const d = db();
  const series = {
    health: pick(DEMO.health),
    healthShare: pick(DEMO.healthShare),
    cpi: pick(DEMO.cpi),
    unemployment: pick(DEMO.unemployment),
    participation: pick(DEMO.participation),
  };

  // Build the paragraph from the release. Every number is an observation with a receipt.
  const sentences: ReactNode[] = [];
  if (series.health) {
    const s = series.health;
    const unit = unitLabel(s.unit, s.scale_factor);
    const pub = publishedObs(s.series_id);
    const main = mainVintage(pub);
    const first = main[0];
    const last = main[main.length - 1];
    if (last) {
      const word = vintageWords(last.vintage).toLowerCase();
      const cell = last.primary_cell_id ? d.cellById.get(last.primary_cell_id) : undefined;
      const src = cell ? d.sourceById.get(cell.source_id) : undefined;
      const share = series.healthShare ? publishedObs(series.healthShare.series_id).find((o) => o.period === last.period && o.vintage === last.vintage) : undefined;
      sentences.push(
        <span key="h1">
          For {last.period}, the federal {word} for current spending on health was <Fig obs={last} /> ({unit})
          {src ? <>, as printed in the {src.title}</> : null}
          {share ? (
            <>
              . That is <Fig obs={share} /> per cent of total federal expenditure in the same column
            </>
          ) : null}
          .{" "}
        </span>,
      );
      const other = pub.filter((o) => o.vintage !== last.vintage).sort((a, b) => a.period.localeCompare(b.period));
      const lastOther = other[other.length - 1];
      if (lastOther) {
        sentences.push(
          <span key="h2">
            The latest checked {vintageWords(lastOther.vintage).toLowerCase()} is <Fig obs={lastOther} /> ({unit}) for {lastOther.period}.{" "}
          </span>,
        );
      }
      if (first && first.obs_id !== last.obs_id) {
        const crossed = s.breaks.find((b) => first.period < b.at_period && b.at_period <= last.period);
        sentences.push(
          <span key="h3">
            The earliest checked {word} in this release is <Fig obs={first} /> ({unit}) for {first.period}.{" "}
            {crossed ? (
              <>
                These two figures should not be compared directly, because the series has a break from {crossed.at_period}: {crossed.note}{" "}
              </>
            ) : null}
          </span>,
        );
      }
    }
  }
  for (const [key, label] of [
    ["cpi", "the general Consumer Price Index stood at"],
    ["unemployment", "the unemployment rate was"],
    ["participation", "the labour force participation rate was"],
  ] as const) {
    const s = series[key];
    if (!s) continue;
    const main = mainVintage(publishedObs(s.series_id));
    const last = main[main.length - 1];
    if (!last) continue;
    sentences.push(
      <span key={key}>
        In {last.period}, {label} <Fig obs={last} /> ({unitLabel(s.unit, s.scale_factor)}).{" "}
      </span>,
    );
  }

  const coming = [DEMO.cpi, DEMO.unemployment, DEMO.participation].filter((slot) => !isDatasetPublished(slot.dataset));
  const comingNames = [...new Set(coming.map((slot) => datasetName(slot.dataset)))];

  return (
    <>
      <p className="eyebrow">Demo</p>
      <h1>Health and jobs: a worked example</h1>
      <p className="lede">
        A short example of what the portal is for. Every chart point and every number in the text below is read from the current release and links
        to its receipt, where you can see it boxed on the government page.
      </p>

      <h2>In plain words</h2>
      {sentences.length > 0 ? (
        <p>{sentences}</p>
      ) : (
        <p className="notice">No checked values for these series are in this release yet, so there is nothing to say in numbers.</p>
      )}
      <p className="small">
        Each linked number is <abbr title={CHECKED_HELP}>checked</abbr>.
        {comingNames.length > 0 ? ` ${comingNames.join(" and ")} ${comingNames.length === 1 ? "is" : "are"} not published in this release yet, so the text says nothing about ${comingNames.length === 1 ? "it" : "them"}.` : ""}{" "}
        Amounts are in current prices and are not adjusted for inflation.
      </p>

      <h2>Health</h2>
      <ChartBlock slot={DEMO.health} series={series.health} />
      <ChartBlock slot={DEMO.healthShare} series={series.healthShare} />

      <h2>Prices</h2>
      <ChartBlock slot={DEMO.cpi} series={series.cpi} />

      <h2>Jobs</h2>
      <ChartBlock slot={DEMO.unemployment} series={series.unemployment} />
      <ChartBlock slot={DEMO.participation} series={series.participation} />

      <Cite path="/demo/health-and-jobs" />
    </>
  );
}
