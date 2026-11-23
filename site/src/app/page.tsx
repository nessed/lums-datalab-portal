// Home: Home v3 (2026-11-23, Ali's overrides of DESIGN.md 9.2 and 15,
// DECISIONS.md D-HV2-2, D-HV2-3 and D-HV3-2). Top to bottom: the lead sentence
// and search, the slim ticker, today's rates (flagged off: names only), key
// numbers, the federal budget beside coming up and the rupee value, just
// updated, what it costs you, your province, where Rs 100 goes, check it
// yourself, everything we hold. Every value is read from the release; every
// change, share, cost or sum is a derived figure recomputed by a plug-in under
// scripts/checks/ (home-derived, home-costs, home-per100); every expected date
// by home-calendar. The key numbers' changes are listed on /methods
// (HomeFormulas, same order); the ticker's at the foot of this page, folded away.
import type { Metadata } from "next";
import { DerivedList, DerivedNotes } from "@/components/home/Bits";
import { HOME_NOTES } from "@/components/home/Moved";
import { Ticker } from "@/components/hub/Hub";
import { CheckItYourself, EverythingWeHold, HomeHero, JustUpdated, KeyTiles, Per100, TodaysRates, WhatItCosts, YourProvince } from "@/components/hub/HomeV2";

export const metadata: Metadata = {
  title: { absolute: "LUMS DataLab: Pakistan's official economic data, each figure linked to its printed page (prototype)" },
};

export default function Home() {
  const keyNotes = new DerivedNotes(HOME_NOTES.prefix, HOME_NOTES.page);
  const keyTiles = KeyTiles({ notes: keyNotes });
  const notes = new DerivedNotes("hub-drv");
  const ticker = Ticker({ notes });

  return (
    <div className="hub v2 v3">
      <h1 className="sr-only">Pakistan&rsquo;s official economic data</h1>
      <HomeHero />
      {ticker}
      <TodaysRates />
      {keyTiles}
      <JustUpdated />
      <WhatItCosts />
      <YourProvince />
      <Per100 />
      <CheckItYourself />
      <EverythingWeHold />
      {notes.items.length ? (
        <details className="hub-drv">
          <summary>How the changes on this page are computed</summary>
          <DerivedList notes={notes} title="Changes and shares on this page" headingId="hub-drv-h" />
        </details>
      ) : null}
    </div>
  );
}
