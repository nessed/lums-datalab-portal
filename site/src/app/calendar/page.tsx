// Release calendar (Home v2, 2026-11-23): a stub. The home page's "Coming up"
// tab reads editorial/calendar.json; this page will list it in full once the
// calendar is confirmed by people. Until then it says it is coming.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";

export const metadata: Metadata = {
  title: "Calendar",
  description: "A calendar of when Pakistan's official statistics are expected. Coming: not in this release.",
};

export default function CalendarPage() {
  return (
    <article className="is-prose prose">
      <Breadcrumbs items={[{ label: "Calendar" }]} />
      <h1>Calendar</h1>
      <p className="coming-block">Coming: a calendar of when each official publication is expected.</p>
      <p>
        Until it is ready, see what this release holds on the <Link href="/library">Library</Link> page, and what changed between releases on{" "}
        <Link href="/releases">Releases and corrections</Link>.
      </p>
    </article>
  );
}
