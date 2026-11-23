// Typeface trial (data hub plan, section 8): one representative first screen set
// once per candidate face behind one token (--demo-face, and --demo-head for
// headings): Noto Sans (the site default) and the candidates in FACES. Ali picks the face by eye; the site default
// stays Noto Sans until he does. Not linked from the navigation, not indexed.
//
// The trial faces are loaded on this page only, from Google Fonts at view
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
  description: "The first screen of the portal in each candidate typeface, for choosing the site's face.",
  robots: { index: false, follow: false },
};

// Ali (2026-11-23) asked for faces with more character than a generic
// interface sans, and turned down a first set (Public Sans, IBM Plex Sans, Fira
// Sans, Schibsted Grotesk, Archivo, Source Sans, Newsreader). Every face below
// is open-licensed (Google Fonts) and was measured in the browser to set
// aligned (tabular) figures in its text cut; faces without them (Libre
// Franklin, Fraunces, Instrument Serif, Lexend and others) were left out, as
// were the Fontshare faces (not open-licensed, and served without aligned
// figures). Serif headings depart from DESIGN.md's "no serif" and are grouped
// so. `head` sets the heading and headline figures, `stack` the rest.
type Face = { key: string; group: string; name: string; note: string; stack: string; head?: string };
const GROUPS: { key: string; title: string }[] = [
  { key: "now", title: "Now" },
  { key: "signs", title: "Faces from public signs and public bodies" },
  { key: "grotesk", title: "Sans with a personality" },
  { key: "pair", title: "Serif headings over a sans (breaks the “no serif” rule)" },
  { key: "serif", title: "All serif (breaks the “no serif” rule)" },
];
const FACES: Face[] = [
  // Today's face, for comparison.
  { key: "atkinson", group: "now", name: "Atkinson Hyperlegible Next", note: "the site face, picked by Ali; by the Braille Institute", stack: "var(--font-atkinson), system-ui, sans-serif" },
  { key: "overpass", group: "signs", name: "Overpass", note: "after Highway Gothic, the American road-sign letters; draws its own rupee sign", stack: "\"Overpass\", system-ui, sans-serif" },
  { key: "barlow", group: "signs", name: "Barlow", note: "after Californian road and licence-plate lettering; tight, made for figures", stack: "\"Barlow\", system-ui, sans-serif" },
  { key: "radiocanada", group: "signs", name: "Radio Canada Big", note: "the Canadian public broadcaster’s face", stack: "\"Radio Canada Big\", system-ui, sans-serif" },
  { key: "familjen", group: "grotesk", name: "Familjen Grotesk", note: "a Swedish grotesque with ink traps and a sharp edge", stack: "\"Familjen Grotesk\", system-ui, sans-serif" },
  { key: "karla", group: "grotesk", name: "Karla", note: "a quirky grotesque; draws its own rupee sign", stack: "\"Karla\", system-ui, sans-serif" },
  { key: "epilogue", group: "grotesk", name: "Epilogue", note: "an editorial grotesque with wide, firm capitals", stack: "\"Epilogue\", system-ui, sans-serif" },
  { key: "funnel", group: "grotesk", name: "Funnel Sans", note: "flared ends that keep small text crisp", stack: "\"Funnel Sans\", system-ui, sans-serif" },
  { key: "redhat", group: "grotesk", name: "Red Hat Display and Text", note: "a display cut for headings, a text cut for the rest", stack: "\"Red Hat Text\", system-ui, sans-serif", head: "\"Red Hat Display\", system-ui, sans-serif" },
  { key: "besley", group: "pair", name: "Besley headings, Overpass text", note: "a Clarendon revival, the face of old bank notes and posters", stack: "\"Overpass\", system-ui, sans-serif", head: "\"Besley\", Georgia, serif" },
  { key: "zilla", group: "pair", name: "Zilla Slab headings, Barlow text", note: "Mozilla’s slab serif over road-sign figures", stack: "\"Barlow\", system-ui, sans-serif", head: "\"Zilla Slab\", Georgia, serif" },
  { key: "caslon", group: "pair", name: "Libre Caslon headings, Familjen Grotesk text", note: "the classic English book face over a sharp grotesque", stack: "\"Familjen Grotesk\", system-ui, sans-serif", head: "\"Libre Caslon Text\", Georgia, serif" },
  { key: "spectral", group: "pair", name: "Spectral headings, Karla text", note: "a fine screen serif over a quirky grotesque", stack: "\"Karla\", system-ui, sans-serif", head: "\"Spectral\", Georgia, serif" },
  { key: "young", group: "pair", name: "Young Serif headings, Radio Canada Big text", note: "a heavy old-style serif over a public broadcaster’s sans", stack: "\"Radio Canada Big\", system-ui, sans-serif", head: "\"Young Serif\", Georgia, serif" },
  { key: "literata", group: "serif", name: "Literata", note: "one serif for everything, made for long reading on screens", stack: "\"Literata\", Georgia, serif" },
];

const latestOf = (s: Series) => latestShown(db().obsBySeries.get(s.series_id) ?? [], mainKind(s)).latest;

function Sample({ heads, ticker, lead }: { heads: Series[]; ticker: Series[]; lead: Series | undefined }) {
  // The lead series' latest figures of its main kind, newest first, for the column of figures.
  const column = lead ? (db().obsBySeries.get(lead.series_id) ?? []).filter((o) => o.kind === mainKind(lead) && showable(o)).slice(-5).reverse() : [];
  return (
    <>
      <p className="ty-kicker">Pakistan&rsquo;s official numbers, checked</p>
      <h4 className="ty-h">Every figure links to the page it was printed on</h4>
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
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;700&family=Barlow:wght@400;700&family=Radio+Canada+Big:wght@400;700&family=Atkinson+Hyperlegible+Next:wght@400;700&family=Familjen+Grotesk:wght@400;700&family=Karla:wght@400;700&family=Epilogue:wght@400;700&family=Funnel+Sans:wght@400;700&display=swap" precedence="default" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- as above */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Red+Hat+Text:wght@400;700&family=Red+Hat+Display:wght@400;700&family=Besley:wght@400;700&family=Zilla+Slab:wght@400;700&family=Libre+Caslon+Text:wght@400;700&family=Spectral:wght@400;700&family=Literata:wght@400;700&family=Young+Serif&display=swap" precedence="default" />
      <header className="ix-head">
        <h1>Type trial</h1>
        <p className="ix-lede">The same first screen in each candidate typeface. Ali picks the face; until then the site stays in Noto Sans.</p>
        <p className="ix-meta">
          Check the column of figures (they should line up digit under digit), the rupee written both as Rs and as the rupee sign, and the two weights. A sign that
          looks unlike the letters around it is one the face lacks and the browser borrowed.
        </p>
      </header>
      {GROUPS.map((g) => (
        <section key={g.key} className="ty-group" aria-labelledby={`tyg-${g.key}`}>
          <h2 id={`tyg-${g.key}`} className="ty-gtitle">
            {g.title}
          </h2>
          <div className="ty-grid">
            {FACES.filter((f) => f.group === g.key).map((f) => (
              <section key={f.key} className="ty-panel" style={{ ["--demo-face" as string]: f.stack, ["--demo-head" as string]: f.head ?? f.stack }} aria-labelledby={`ty-${f.key}`}>
                <h3 id={`ty-${f.key}`} className="ty-face">
                  {f.name} <span>{f.note}</span>
                </h3>
                <Sample heads={heads} ticker={ticker} lead={lead} />
              </section>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
