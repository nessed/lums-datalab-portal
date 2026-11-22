import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import localFont from "next/font/local";
import { NavLinks, MobileMenu, UsefulPrompt } from "@/components/chrome/Chrome";
import editorial from "../../editorial.config.json";
import { Num } from "@/components/ui/Num";
import SearchDialog from "@/components/chrome/SearchDialog";
import EvidenceSheet from "@/components/evidence/EvidenceSheet";
import { DATA_BASE, db, ISSUES_URL, REPO_URL, SITE_URL } from "@/lib/data";
import { dateOnly } from "@/lib/format";
import "./globals.css";
import "@/styles/base.css";
import "@/styles/evidence.css";
import "@/styles/series.css";
import "@/styles/search.css";
import "@/styles/home.css";
import "@/styles/downloads.css";
import "@/styles/compare.css";
import "@/styles/hub.css";
import "@/styles/library.css";
import "@/styles/fixes.css";
import "@/styles/v2.css";

// Self-hosted (OFL, licences beside the files in src/fonts) so the build needs no
// network. Atkinson Hyperlegible Next (Braille Institute), Ali's pick from
// /demo/type on 2026-11-23, for text: one variable font (wght 400-700, subset by
// scripts/subset-fonts.py's make()). Home v2 (2026-11-23, Ali) adds Archivo
// (variable width 75-110 % and weight 700-800) for headings and large numerals,
// and Atkinson Hyperlegible Mono (wght 400-700) for page references; both subset
// by scripts/subset-fonts-v2.py. Number places set tabular figures, which all
// three have. The CSS variables feed --font-sans, --font-display and --font-ref
// in src/design/tokens.css.
const sans = localFont({
  src: [{ path: "../fonts/atkinson-hyperlegible-next-latin-wght-400-700.woff2", style: "normal", weight: "400 700" }],
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["Segoe UI", "system-ui", "Arial", "sans-serif"],
});
const display = localFont({
  src: [{ path: "../fonts/archivo-latin-wdth-75-110-wght-700-800.woff2", style: "normal", weight: "700 800" }],
  variable: "--font-archivo",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 110%" }],
  fallback: ["Arial Narrow", "Segoe UI", "Arial", "sans-serif"],
});
const ref = localFont({
  src: [{ path: "../fonts/atkinson-hyperlegible-mono-latin-wght-400-700.woff2", style: "normal", weight: "400 700" }],
  variable: "--font-ahmono",
  display: "swap",
  fallback: ["Cascadia Mono", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: { default: "LUMS DataLab: Pakistan's official statistics, checked (prototype)", template: "%s · LUMS DataLab (prototype)" },
  description:
    "A research bank of Pakistan's economic and fiscal data in which every number links to the spot on the government page it came from and the checks it passed. Unofficial research prototype.",
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
};

// Home v2 (2026-11-23, Ali's override of DESIGN.md 9.1; DECISIONS.md D-HV2-1):
// new labels; every address that worked before still works (routes-alive).
const NAV = [
  { href: "/", label: "Today" },
  { href: "/topics/prices", label: "Prices" },
  { href: "/topics/spending", label: "Budget", also: ["/topics/revenue"] },
  { href: "/topics/jobs", label: "Jobs" },
  { href: "/topics/provinces", label: "Provinces" },
  { href: "/browse", label: "Explore data", also: ["/series", "/search", "/compare", "/answers"] },
  { href: "/library", label: "Library", also: ["/sources", "/datasets", "/tables", "/data"] },
  { href: "/calendar", label: "Calendar" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const release = db().release;
  const v = release.version;
  const built = dateOnly(release.created_at);
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${ref.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add("js")` }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="ub" role="note" aria-label="Release and prototype notice">
          <div className="wrap ub-row">
            <p className="ub-note">
              <span className="ub-date">
                Release <Num kind="version">{v}</Num>, built <Num kind="date">{built}</Num>
              </span>
              <span className="ub-proto">
                <strong>Prototype.</strong> Not yet for citation<span className="long">; the printed document prevails</span>.{" "}
                <Link href="/about#disclaimer">Disclaimer</Link>
              </span>
            </p>
            <nav className="ub-links" aria-label="About this site">
              <Link href="/about">About</Link>
              <Link href="/methods">How we check</Link>
              <Link href="/releases">Corrections</Link>
              <Link href="/api">Data API</Link>
            </nav>
          </div>
        </div>
        <header className="mast">
          <div className="wrap mast-row">
            <Link href="/" className="wm" aria-label="LUMS DataLab, prototype: home">
              <span className="wm-block" aria-hidden="true" />
              <span className="wm-text">
                <span className="wm-name">LUMS DataLab</span>
                <span className="wm-tag">Pakistan&rsquo;s economy in official numbers</span>
              </span>
            </Link>
            <NavLinks items={NAV} className="mast-nav" />
            <MobileMenu items={NAV} />
          </div>
        </header>
        <div className="srow">
          <div className="wrap">
            <SearchDialog indexUrl={`${DATA_BASE}/search.json`} variant="big" />
            {editorial.exampleSearches?.length ? (
              <p className="srow-trend">
                <span className="srow-trend-h">People look for</span>
                {editorial.exampleSearches.map((t) => (
                  <Link key={t} href={`/search?q=${encodeURIComponent(t)}`}>
                    {t}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
        </div>
        <main id="main" tabIndex={-1}>
          <div className="wrap">{children}</div>
        </main>
        <EvidenceSheet />
        <aside className="fb" aria-label="Feedback">
          <div className="wrap">
            <UsefulPrompt issuesUrl={ISSUES_URL} version={v} />
          </div>
        </aside>
        <footer className="site-footer ft2">
          <div className="wrap">
            <div className="ft2-grid">
              <div className="ft2-brand">
                <p className="ft2-wm">
                  <span className="wm-block" aria-hidden="true" /> LUMS DataLab
                </p>
                <p>
                  Every figure links to the government page it was printed on and is published only after fixed arithmetic checks.{" "}
                  <Link href="/methods">How we check</Link>
                </p>
              </div>
              <nav aria-label="Topics">
                <h2>Topics</h2>
                <ul>
                  <li><Link href="/topics/prices">Prices</Link></li>
                  <li><Link href="/topics/spending">Budget</Link></li>
                  <li><Link href="/topics/revenue">Revenue</Link></li>
                  <li><Link href="/topics/jobs">Jobs</Link></li>
                  <li><Link href="/topics/provinces">Provinces</Link></li>
                </ul>
              </nav>
              <nav aria-label="Use the data">
                <h2>Use the data</h2>
                <ul>
                  <li><Link href="/browse">Explore data</Link></li>
                  <li><Link href="/library">Library</Link></li>
                  <li><Link href="/compare">Chart builder</Link></li>
                  <li><Link href="/answers">Stories</Link></li>
                  <li><Link href="/data">Downloads and file formats</Link></li>
                  <li><Link href="/api">Data API</Link></li>
                </ul>
              </nav>
              <nav aria-label="Trust">
                <h2>Trust</h2>
                <ul>
                  <li><Link href="/methods">How we check</Link></li>
                  <li><Link href="/releases">Releases and corrections</Link></li>
                  <li><Link href="/about">About</Link></li>
                  <li><a href={REPO_URL}>Source code</a></li>
                </ul>
              </nav>
            </div>
            <p className="ft-rel">
              <Link href="/releases" className="ft-tag" title="The data release this site shows">
                Release <Num kind="version">{v}</Num>
              </Link>
              , built <Num kind="date">{built}</Num>. Prototype{release.doi ? <>; DOI <Num kind="id">{release.doi}</Num></> : null}. Where
              this site and the printed document differ, the document prevails. Data <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, code MIT.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
