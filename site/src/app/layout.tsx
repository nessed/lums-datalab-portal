import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import localFont from "next/font/local";
import { AboutMenu, HeaderSearch, NavLinks, MobileMenu, UsefulPrompt } from "@/components/chrome/Chrome";
import { Num } from "@/components/ui/Num";
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
import "@/styles/v3-chrome.css";
import "@/styles/v3-home.css";
import "@/styles/v3-series.css";
import "@/styles/v3-find.css";
import "@/styles/v3-pages.css";

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

// Home v3 (2026-11-23, Ali's override of DESIGN.md 9.1; DECISIONS.md D-HV3-1):
// three main links and an About menu; the search field sits in the header on
// every page but the home page, which has the large one. Every address that
// worked before still works (routes-alive).
const NAV = [
  {
    href: "/browse",
    label: "Find data",
    also: ["/series", "/search", "/compare", "/answers", "/topics", "/library", "/sources", "/datasets", "/tables", "/data", "/o", "/inflation-calculator"],
  },
  { href: "/releases", label: "What’s new", also: ["/calendar"] },
  { href: "/guides", label: "Guides" },
];
const ABOUT = [
  { href: "/about", label: "About the DataLab" },
  { href: "/methods", label: "How we check" },
  { href: "/releases#corrections", label: "Corrections" },
  { href: "/releases", label: "Releases and versions" },
  { href: "/about#contact-h", label: "Contact and errors" },
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
        <header className="mast mast3">
          <div className="wrap mast-row">
            <Link href="/" className="wm" aria-label="LUMS DataLab, prototype: home">
              <span className="wm-block" aria-hidden="true" />
              <span className="wm-text">
                <span className="wm-name">LUMS DataLab</span>
                <span className="wm-tag">Pakistan&rsquo;s economy in official numbers</span>
              </span>
            </Link>
            <NavLinks items={NAV} className="mast-nav">
              <AboutMenu items={ABOUT} />
            </NavLinks>
            <HeaderSearch indexUrl={`${DATA_BASE}/search.json`} />
            <MobileMenu items={[...NAV, ...ABOUT.filter((a) => a.href !== "/releases")]} />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="wrap">{children}</div>
        </main>
        <EvidenceSheet />
        <aside className="fb" aria-label="Feedback">
          <div className="wrap">
            <UsefulPrompt issuesUrl={ISSUES_URL} version={v} />
          </div>
        </aside>
        <footer className="site-footer ft2 ft3">
          <div className="wrap">
            <div className="ft2-grid">
              <div className="ft2-brand">
                <p className="ft2-wm">
                  <span className="wm-block" aria-hidden="true" /> LUMS DataLab
                </p>
                <p className="ft3-dept">Department of Economics, Lahore University of Management Sciences</p>
                <p className="ft3-note">
                  Compiled from official government publications. This is not an official statistical release; where this site and the printed
                  document differ, the document prevails. <Link href="/about#disclaimer">Disclaimer</Link>
                </p>
              </div>
              <nav aria-label="Find data">
                <h2>Find data</h2>
                <ul>
                  <li><Link href="/topics/prices">Prices</Link></li>
                  <li><Link href="/topics/spending">Federal budget</Link></li>
                  <li><Link href="/topics/jobs">Jobs</Link></li>
                  <li><Link href="/topics/provinces">Provinces</Link></li>
                  <li><Link href="/compare/education">Compare provinces</Link></li>
                  <li><Link href="/inflation-calculator">Inflation calculator</Link></li>
                </ul>
              </nav>
              <nav aria-label="Use the data">
                <h2>Use the data</h2>
                <ul>
                  <li><Link href="/data">Downloads</Link></li>
                  <li><Link href="/methods#cite">How to cite</Link></li>
                  <li><Link href="/api">Data API</Link></li>
                  <li><Link href="/guides">Guides</Link></li>
                  <li><Link href="/library">Library</Link></li>
                  <li><Link href="/compare">Chart builder</Link></li>
                </ul>
              </nav>
              <nav aria-label="About">
                <h2>About</h2>
                <ul>
                  <li><Link href="/about">About the DataLab</Link></li>
                  <li><Link href="/methods">How we check</Link></li>
                  <li><Link href="/releases#corrections">Corrections</Link></li>
                  <li><a href={`${ISSUES_URL}/new`}>Report an error</a></li>
                  <li><a href={REPO_URL}>Source code</a></li>
                </ul>
              </nav>
            </div>
            <p className="ft-rel">
              <Link href="/releases" className="ft-tag" title="The data release this site shows">
                Release <Num kind="version">{v}</Num>
              </Link>
              , built <Num kind="date">{built}</Num>. Prototype, not yet for citation{release.doi ? <>; DOI <Num kind="id">{release.doi}</Num></> : null}. Data{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, code MIT.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
