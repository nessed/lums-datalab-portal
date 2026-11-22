// Home: the data hub (data hub plan, section 5; Ali's overrides of DESIGN.md 9.2
// and 16, DECISIONS.md 2026-11-23). Top to bottom: ticker, the featured chart
// with the key numbers beside it, what moved, stories, the library strip,
// themes. Every value is read from the release; every change is a derived
// figure recomputed by scripts/checks/home-derived.mjs or home-stories.mjs.
// The key numbers' changes are listed on /methods (HomeFormulas, same order);
// the ticker's and the stories' at the foot of this page, folded away.
import type { Metadata } from "next";
import { DerivedList, DerivedNotes } from "@/components/home/Bits";
import { HOME_NOTES } from "@/components/home/Moved";
import { Featured, KeyNumbers, LibraryStrip, StoryCards, Themes, Ticker, WhatMoved } from "@/components/hub/Hub";
import { stories } from "@/components/hub/stories";

export const metadata: Metadata = {
  title: { absolute: "LUMS DataLab: Pakistan's official economic data, each figure linked to its printed page (prototype)" },
};

export default function Home() {
  const keyNotes = new DerivedNotes(HOME_NOTES.prefix, HOME_NOTES.page);
  const keyNumbers = KeyNumbers({ notes: keyNotes });
  const notes = new DerivedNotes("hub-drv");
  const ticker = Ticker({ notes }); // called now so its changes are listed first
  const list = stories(notes);
  const featured = list.find((s) => s.featured) ?? list[0];
  const rest = list.filter((s) => s !== featured).slice(0, 4);

  return (
    <div className="hub">
      <h1 className="hub-title">Pakistan&rsquo;s official economic data</h1>
      {ticker}
      <div className="hub-main">
        {featured ? <Featured story={featured} /> : null}
        {keyNumbers}
      </div>
      <WhatMoved />
      <StoryCards list={rest} />
      <LibraryStrip />
      <Themes />
      {notes.items.length ? (
        <details className="hub-drv">
          <summary>How the changes on this page are computed</summary>
          <DerivedList notes={notes} title="Changes and shares on this page" headingId="hub-drv-h" />
        </details>
      ) : null}
    </div>
  );
}
