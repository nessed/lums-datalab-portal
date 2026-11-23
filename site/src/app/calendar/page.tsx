// Release calendar (Home v3 pages set, 2026-11-24): the official publications
// this site reads, with the month each next edition is expected (or the day the
// agency announced), from editorial/calendar.json. The same list is the
// "Upcoming" tab of /releases. Dates are checked by home-calendar.mjs.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import Crumbs from "@/components/chrome/Crumbs";
import Upcoming from "@/components/find/Upcoming";
import "@/styles/v4-releases.css";

export const metadata: Metadata = {
  title: "Release calendar",
  description: "When the next editions of the official publications this site reads are expected, or announced.",
};

export default function CalendarPage() {
  return (
    <div className="rl4p">
      <Crumbs items={[{ href: "/releases", label: "Releases" }, { label: "Release calendar" }]} />
      <header className="rl4p-head">
        <div>
          <h1>Release calendar</h1>
          <p className="rl4p-lede">
            What the government is due to publish next, for the publications this site reads. What has already been added is under{" "}
            <Link href="/releases?tab=added#added">Releases</Link>.
          </p>
        </div>
      </header>
      <Upcoming />
    </div>
  );
}
