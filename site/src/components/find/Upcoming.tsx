// Upcoming official releases (Home v3 pages set, 2026-11-24), on /releases and
// /calendar: editorial/calendar.json grouped by month, each with an Announced or
// Expected badge. Not data: these are dates, checked by home-calendar.mjs (the
// file) and whatsnew-calendar.mjs (on /releases every entry once, introduced
// "Expected " or "Announced for " right before its date).
import { Num } from "@/components/ui/Num";
import { periodWords } from "@/lib/format";
import calendar from "../../../editorial/calendar.json";

type CalEntry = { id: string; name: string; agency: string; when: string; status: string; basis?: string };

export default function Upcoming() {
  const cal = (calendar.entries as CalEntry[]).slice().sort((a, b) => a.when.localeCompare(b.when) || a.name.localeCompare(b.name));
  const months = [...new Set(cal.map((e) => e.when.slice(0, 7)))];
  return (
    <div className="up-grid">
      <div className="up-main">
        {cal.length === 0 ? <p className="muted">No dates are expected yet.</p> : null}
        {months.map((m) => (
          <section key={m} aria-label={periodWords(m, "month")}>
            <h2 className="up-month">
              <Num kind="ui">{periodWords(m, "month")}</Num>
            </h2>
            <ul className="up-list">
              {cal
                .filter((e) => e.when.slice(0, 7) === m)
                .map((e) => (
                  <li key={e.id} className="up-row" data-cal-entry={e.id}>
                    <span className="up-when">
                      {e.status === "announced" ? "Announced for " : "Expected "}
                      <span data-num={e.status === "announced" ? "date" : "ui"} data-cal={e.id}>
                        {e.status === "announced" ? e.when : periodWords(e.when, "month")}
                      </span>
                    </span>
                    <span className="up-what">
                      <strong>{e.name}</strong>
                      <span className="up-who">
                        {e.agency}
                        {e.basis ? ` · ${e.basis}` : ""}
                      </span>
                    </span>
                    <span className={`up-badge${e.status === "announced" ? " is-announced" : ""}`}>{e.status === "announced" ? "Announced" : "Expected"}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <aside className="up-side">
        <section className="up-note">
          <h2>Announced or expected</h2>
          <p>
            <strong>Announced</strong> dates come from the publisher. <strong>Expected</strong> dates are our estimate from when each publication usually appears
            {calendar.provisional ? "; the list is not yet confirmed by the team" : ""}.
          </p>
        </section>
        <section className="up-note">
          <h2>In your own calendar</h2>
          <p>Coming soon: a calendar file to add these dates to Outlook or Google, and an email when a publication you follow is added.</p>
        </section>
      </aside>
    </div>
  );
}
