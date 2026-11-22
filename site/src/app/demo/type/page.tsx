// Typeface trial (data hub plan, section 8): one representative first screen set
// three times behind one token (--demo-face): Noto Sans (the site default),
// IBM Plex Sans and Source Sans 3. Ali picks the face by eye; the site default
// stays Noto Sans until he does. Not linked from the navigation, not indexed.
//
// The two trial faces are loaded on this page only, from Google Fonts at view
// time (a <link> React hoists into the head), not with next/font/google: that
// would download them at build time, and the site's build needs no network
// (layout.tsx self-hosts Noto for that reason). Every figure is read from the
// release through V / ShortValue and links to its receipt; nothing is typed in.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import Spark from "@/components/Spark";
import { Num, V } from "@/components/ui/Num";
import { ShortValue } from "@/components/home/Bits";
import { mainKind } from "@/components/home/Topic";
import { latestShown, showable } from "@/components/home/derive";
import { topics } from "@/components/home/editorial";
import { basis } from "@/components/indicators/Basis";
import { db, seriesHref, type Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { seriesTitle } from "@/lib/titles";

export const metadata: Metadata = {
  title: "Type trial",
  description: "The first screen of the portal in three typefaces, for choosing the site's face.",
  robots: { index: false, follow: false },
};

const FACES = [
  { key: "noto", name: "Noto Sans", note: "the site default now", stack: "var(--font-noto-sans), \"Noto Sans\", system-ui, sans-serif" },
  { key: "plex", name: "IBM Plex Sans", note: "loaded on this page only", stack: "\"IBM Plex Sans\", system-ui, sans-serif" },
  { key: "source", name: "Source Sans 3", note: "loaded on this page only", stack: "\"Source Sans 3\", system-ui, sans-serif" },
];

const latestOf = (s: Series) => latestShown(db().obsBySeries.get(s.series_id) ?? [], mainKind(s)).latest;

function Sample({ heads, ticker, lead }: { heads: Series[]; ticker: Series[]; lead: Series | undefined }) {
  // The lead series' latest figures of its main kind, newest first, for the column of figures.
  const column = lead ? (db().obsBySeries.get(lead.series_id) ?? []).filter((o) => o.kind === mainKind(lead) && showable(o)).slice(-5).reverse() : [];
  return (
    <>
      <p className="ty-kicker">Pakistan&rsquo;s official numbers, checked</p>
      <h2 className="ty-h">Every figure links to the page it was printed on</h2>
      <ul className="ty-figs">
        {heads.map((s) => {
          const o = latestOf(s);
          return o ? (
            <li key={s.series_id}>
              <Link href={seriesHref(s.series_id)} className="ty-name">
                {seriesTitle(s)}
              </Link>
              <ShortValue o={o} series={s} className="ty-value" />
              <span className="ty-basis">{basis(o, s)}</span>
            </li>
          ) : null;
        })}
      </ul>
      <ul className="ty-ticker" aria-label="Latest figures">
        {ticker.map((s) => {
          const o = latestOf(s);
          return o ? (
            <li key={s.series_id}>
              <span className="ty-tname">{seriesTitle(s)}</span> <ShortValue o={o} series={s} />
            </li>
          ) : null;
        })}
      </ul>
      {lead && column.length ? (
        <div className="ty-lead">
          <div>
            <p className="ty-name">{seriesTitle(lead)}, Rs million and &#8360; million</p>
            <table className="ty-col">
              <tbody>
                {column.map((o) => (
                  <tr key={o.obs_id}>
                    <th scope="row">
                      <Num kind="period">{periodWords(o.period, lead.frequency)}</Num>
                    </th>
                    <td>
                      Rs <V o={o} />
                    </td>
                    <td>
                      &#8360; <V o={o} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Spark series={lead} width={180} height={48} link={false} />
        </div>
      ) : null}
    </>
  );
}

export default function TypeTrialPage() {
  const ts = topics();
  const heads = ts.slice(0, 3).map((t) => t.headline[0]).filter((s): s is Series => !!s);
  const ticker = ts.flatMap((t) => t.headline).slice(0, 6);
  const lead = ts.flatMap((t) => t.headline).find((s) => s.unit === "PKR");
  return (
    <article className="ty">
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- loading on this one page only is the point (see the comment at the top) */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&family=Source+Sans+3:wght@400;700&display=swap"
        precedence="default"
      />
      <header className="ix-head">
        <h1>Type trial</h1>
        <p className="ix-lede">The same first screen in three typefaces. Ali picks the face; until then the site stays in Noto Sans.</p>
        <p className="ix-meta">
          Check the column of figures (they should line up digit under digit), the rupee written both as Rs and as the rupee sign, and the two weights. A sign that
          looks unlike the letters around it is one the face lacks and the browser borrowed.
        </p>
      </header>
      <div className="ty-grid">
        {FACES.map((f) => (
          <section key={f.key} className="ty-panel" style={{ ["--demo-face" as string]: f.stack }} aria-labelledby={`ty-${f.key}`}>
            <h2 id={`ty-${f.key}`} className="ty-face">
              {f.name} <span>{f.note}</span>
            </h2>
            <Sample heads={heads} ticker={ticker} lead={lead} />
          </section>
        ))}
      </div>
    </article>
  );
}
