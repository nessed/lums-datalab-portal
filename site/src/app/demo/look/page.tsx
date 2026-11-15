// Specimen of the round-2 base components (components/ui/*), for the people and
// agents who build pages on them. Not linked from the site's navigation and not
// indexed. Every figure is read from the release through the adapter and is a
// receipt link; nothing here is typed in. Statements are about the components,
// never about the data.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import Arrow from "@/components/ui/Arrow";
import { Card, Panel } from "@/components/ui/Card";
import { ButtonLink, Chips, SegTabs } from "@/components/ui/Controls";
import FactPills from "@/components/ui/FactPills";
import NumberBlock from "@/components/ui/NumberBlock";
import PrintedPagePill from "@/components/ui/PrintedPagePill";
import SeriesId from "@/components/ui/SeriesId";
import Spark from "@/components/Spark";
import { Num, V } from "@/components/ui/Num";
import { StatusLegend } from "@/components/ui/Status";
import { obsHref, publishedObs, seriesHref, slugify, visibleSeries, type Observation, type Series } from "@/lib/data";
import { KIND } from "@/lib/words";

export const metadata: Metadata = {
  title: "Look: base components",
  description: "Specimen of the portal's base components (round 2): headline figure, fact pills, series id, chips, buttons, cards.",
  robots: { index: false, follow: true },
};

/** The newest published figure of a series (by period, then the later vintage in the file's order). */
function latest(s: Series): Observation | null {
  const obs = publishedObs(s.series_id);
  if (!obs.length) return null;
  return [...obs].sort((a, b) => a.period.localeCompare(b.period))[obs.length - 1];
}

export default function LookPage() {
  const series = visibleSeries().filter((s) => !s.derived && publishedObs(s.series_id).length >= 2);
  const lead = series.find((s) => /health/.test(s.series_id)) ?? series[0];
  const o = lead ? latest(lead) : null;
  const periods = lead ? publishedObs(lead.series_id).map((x) => x.period).sort() : [];
  const cards = series.slice(0, 4);
  return (
    <div className="look-specimen">
      <p className="kicker">For page builders</p>
      <h1>Base components</h1>
      <p className="lede">
        What the round-2 look gives every page. Source and usage notes are at the top of each file in <code>src/components/ui</code>.
      </p>

      {lead && o ? (
        <Panel label="Headline figure">
          <h2 className="look-h">
            <Num kind="text">{lead.name}</Num> <SeriesId id={lead.series_id} />
          </h2>
          <FactPills
            label="About this series"
            items={[
              { label: "Covers", value: periods.length ? <><Num kind="period">{periods[0]}</Num> to <Num kind="period">{periods[periods.length - 1]}</Num></> : null },
              { label: "Kind", value: KIND[o.kind]?.long ?? null },
              { label: "Series page", value: <Link href={seriesHref(lead.series_id)}>open</Link> },
            ]}
          />
          <NumberBlock
            label={
              <>
                {KIND[o.kind]?.long ?? "Figure"}, <Num kind="period">{o.period}</Num>
              </>
            }
            value={<V o={o} short sheet />}
            answer={<>The one-sentence plain answer sits here, on the gold-tinted highlight, in ink.</>}
            change={
              <>
                <Arrow dir="up" label={false} /> up, <Arrow dir="down" label={false} /> down, <Arrow dir="flat" label={false} /> no change: the change line is neutral ink, with words.
              </>
            }
          >
            <PrintedPagePill href={obsHref(o.obs_id)} sheet={slugify(o.obs_id)} />
          </NumberBlock>
          <p className="small muted">Hover or focus the figure: the receipt mark shows that it opens its evidence.</p>
        </Panel>
      ) : null}

      <h2>Chips, segmented tabs, buttons</h2>
      <Panel label="Controls">
        <Chips
          label="Example filter"
          items={[
            { href: "#controls", label: "All topics", active: true },
            { href: "#controls", label: "Prices", key: "p" },
            { href: "#controls", label: "Budget", key: "b" },
            { href: "#controls", label: "Labour", key: "l" },
          ]}
        />
        <p />
        <SegTabs
          label="Example view"
          items={[
            { href: "#controls", label: "Chart", active: true },
            { href: "#controls", label: "Table", key: "t" },
            { href: "#controls", label: "Notes", key: "n" },
          ]}
        />
        <div className="action-row" id="controls">
          <ButtonLink href="/data" primary>
            Download the data
          </ButtonLink>
          <ButtonLink href="/methods">Methods</ButtonLink>
          <button type="button" className="btn">
            Neutral button
          </button>
        </div>
      </Panel>

      <h2>Cards</h2>
      <div className="look-cards">
        {cards.map((s) => {
          const x = latest(s);
          return (
            <Card key={s.series_id} title={<Link href={seriesHref(s.series_id)}><Num kind="text">{s.name}</Num></Link>} meta={x ? <><Num kind="period">{x.period}</Num></> : null}>
              {x ? <NumberBlock size="l" value={<V o={x} short />} /> : null}
              <Spark series={s} width={160} height={36} />
            </Card>
          );
        })}
      </div>

      <h2>Status marks</h2>
      <Panel label="Status key">
        <StatusLegend />
      </Panel>
    </div>
  );
}
