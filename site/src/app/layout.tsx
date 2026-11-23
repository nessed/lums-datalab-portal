import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import localFont from "next/font/local";
import { HeaderSearch, NavLinks, NavMenu, MobileMenu, ReportLink, UsefulPrompt } from "@/components/chrome/Chrome";
import { isOn } from "@/lib/features";
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
import "@/styles/v4-chrome.css";

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

// Home v3 pages set (2026-11-24, design handoff "Home v3 set"): six items.
// Data by topic, Indicators A to Z, Releases and Library are links; Tools and
// About open short menus. Labels changed, addresses did not (routes-alive).
const NAV = [
  { href: "/topics", label: "Data by topic", also: ["/answers", "/datasets", "/tables"] },
  { href: "/browse", label: "Indicators A to Z", also: ["/series", "/search", "/o", "/data"] },
  { href: "/releases", label: "Releases", also: ["/calendar"] },
  { href: "/library", label: "Library", also: ["/sources"] },
];
const TOOLS = [
  { href: "/inflation-calculator", label: "Inflation calculator" },
  { href: "/compare", label: "Chart builder" },
  { href: "/compare/education", label: "Compare provinces" },
  { href: "/guides", label: "Guides" },
];
const ABOUT = [
  { href: "/about", label: "About the DataLab" },
  { href: "/methods", label: "How we check" },
  { href: "/releases#corrections", label: "Corrections" },
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
        <div className="util3">
          <div className="wrap util3-row">
            <p className="util3-unit">
              A research unit of the <Link href="/about">Department of Economics, Lahore University of Management Sciences</Link>
            </p>
            <ul className="util3-links">
              <li><Link href="/calendar">Release calendar</Link></li>
              <li><Link href="/api">Data API</Link></li>
              <li><ReportLink issuesUrl={ISSUES_URL} version={v}>Report an error</ReportLink></li>
              {isOn("urdu") ? (
                <li lang="ur">
                  <Link href="/ur">اردو</Link>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <header className="mast mast3 mast4">
          <div className="wrap mast-row">
            <Link href="/" className="wm4" aria-label="LUMS Department of Economics DataLab: home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lums-logo.png" alt="" width={118} height={30} className="wm4-logo" />
              <span className="wm4-rule" aria-hidden="true" />
              <span className="wm4-text">
                <span className="wm4-dept">Department of Economics</span>
                <span className="wm4-name">DataLab</span>
              </span>
            </Link>
            <NavLinks items={NAV} className="mast-nav">
              <NavMenu label="Tools" items={TOOLS} on={["/inflation-calculator", "/compare", "/guides"]} />
              <NavMenu label="About" items={ABOUT} on={["/about", "/methods", "/api"]} />
            </NavLinks>
            <HeaderSearch indexUrl={`${DATA_BASE}/search.json`} />
            <MobileMenu items={[...NAV, ...TOOLS, ...ABOUT]} />
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
        <footer className="site-footer ft2 ft3 ft4">
          <div className="wrap">
            <div className="ft4-grid">
              <div className="ft4-brand">
                <p className="ft4-wm">LUMS DataLab</p>
                <p className="ft3-dept">
                  Department of Economics, Lahore University of Management Sciences
                  <br />
                  <span className="ft4-addr">
                    DHA, Lahore Cantt. <Num kind="ui">54792</Num>, Pakistan
                  </span>
                </p>
                <p className="ft3-note">
                  Compiled from official government publications. This is not an official statistical release; where this site and the printed
                  document differ, the document prevails. <Link href="/about#disclaimer">Disclaimer</Link>
                </p>
              </div>
              <nav aria-label="Find data">
                <h2>Find data</h2>
                <ul>
                  <li><Link href="/topics">Data by topic</Link></li>
                  <li><Link href="/browse">Indicators A to Z</Link></li>
                  <li><Link href="/topics/provinces">Provinces</Link></li>
                  <li><Link href="/library">Library of documents</Link></li>
                  <li><Link href="/calendar">Release calendar</Link></li>
                </ul>
              </nav>
              <nav aria-label="Use the data">
                <h2>Use the data</h2>
                <ul>
                  <li><Link href="/data">Bulk download</Link></li>
                  <li><Link href="/api">Data API</Link></li>
                  <li><Link href="/methods#cite">How to cite</Link></li>
                  <li><Link href="/compare">Chart builder</Link></li>
                  <li><Link href="/guides">Guides</Link></li>
                </ul>
              </nav>
              <nav aria-label="About">
                <h2>About</h2>
                <ul>
                  <li><Link href="/about">About the DataLab</Link></li>
                  <li><Link href="/methods">How we check</Link></li>
                  <li><Link href="/releases#corrections">Corrections</Link></li>
                  <li><Link href="/about#contact-h">Contact</Link></li>
                  <li><a href={REPO_URL}>Source code</a></li>
                </ul>
              </nav>
            </div>
            <p className="ft-rel ft4-rel">
              <span>
                Data last updated <Num kind="date">{built}</Num>
              </span>
              <Link href="/releases" title="The data release this site shows">
                Version history (release <Num kind="version">{v}</Num>)
              </Link>
              {release.doi ? (
                <span>
                  DOI <Num kind="id">{release.doi}</Num>
                </span>
              ) : null}
              <span>
                Data <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, code MIT
              </span>
              <span>Research prototype: not yet for citation in publications</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
