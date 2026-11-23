// Home: Home v3 pages set (design handoff, 2026-11-24). Top to bottom: the search
// band, the ticker, the featured chart beside the key indicators (auto-cycling),
// today's rates (flag dailyRates off: names only), insights (flag insights off:
// coming soon), Pakistan at a glance with the province map, data by topic, latest
// releases beside coming up, the inflation calculator and more tools, where the
// figures come from. Every value is read from the release; every change is a
// derived figure recomputed by home-derived, every publisher count by
// home-publishers, the calculator's result by calc-inflation, every expected date
// by home-calendar. The ticker stays (home-stories requires it). The old home's
// sections (what it costs you, your province, where Rs 100 goes, check it
// yourself) keep their components in components/hub/HomeV2.tsx.
import type { Metadata } from "next";
import { DerivedList, DerivedNotes } from "@/components/home/Bits";
import { HOME_NOTES } from "@/components/home/Moved";
import { Ticker } from "@/components/hub/Hub";
import { AtAGlance, HomeDashboard, Insights, Publishers, RatesStrip, ReleasesRow, SearchBand, ToolsBand, TopicGrid } from "@/components/hub/HomeV4";

export const metadata: Metadata = {
  title: { absolute: "LUMS DataLab: Pakistan's economy in official numbers, each figure linked to its printed page (prototype)" },
};

export default function Home() {
  const keyNotes = new DerivedNotes(HOME_NOTES.prefix, HOME_NOTES.page);
  const dashboard = HomeDashboard({ notes: keyNotes });
  const notes = new DerivedNotes("hub-drv");
  const ticker = Ticker({ notes });

  return (
    <div className="home4">
      <SearchBand />
      {ticker ? (
        <div className="tk4">
          <div className="wrap tk4-in">
            <span className="tk4-h">Latest</span>
            {ticker}
          </div>
        </div>
      ) : null}
      <div className="home4-body">
        {dashboard}
        <RatesStrip />
        <Insights />
        <AtAGlance />
        <TopicGrid />
        <ReleasesRow />
      </div>
      <ToolsBand />
      <div className="home4-body">
        <Publishers />
        {notes.items.length ? (
          <details className="hub-drv">
            <summary>How the changes on this page are computed</summary>
            <DerivedList notes={notes} title="Changes and shares on this page" headingId="hub-drv-h" />
          </details>
        ) : null}
      </div>
    </div>
  );
}
