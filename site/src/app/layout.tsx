import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/Link";
import localFont from "next/font/local";
import { NavLinks, DismissNotice, ReportLink, MobileMenu } from "@/components/chrome/Chrome";
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

// Self-hosted (OFL, licences beside the files in src/fonts) so the build needs no
// network. Atkinson Hyperlegible Next (Braille Institute), Ali's pick from
// /demo/type on 2026-11-23: one variable font (wght 400-700, 19 KB, subset to
// Latin plus the rupee signs by scripts/subset-fonts.py's make()) for text, titles
// and headline figures. Its figures are proportional by default; number places
// (.tnum, tables, charts, headline blocks) set tabular figures, which it has.
// The CSS variable is used by --font-sans and --font-display in src/design/tokens.css.
const sans = localFont({
  src: [{ path: "../fonts/atkinson-hyperlegible-next-latin-wght-400-700.woff2", style: "normal", weight: "400 700" }],
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["Segoe UI", "system-ui", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "LUMS DataLab: Pakistan's official statistics, checked (prototype)", template: "%s · LUMS DataLab (prototype)" },
  description:
    "A research bank of Pakistan's economic and fiscal data in which every number links to the spot on the government page it came from and the checks it passed. Unofficial research prototype.",
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
};

// Data hub run (2026-11-23, Ali's override of DESIGN.md 9.1): five plain labels;
// the addresses did not change.
const NAV = [
  { href: "/topics", label: "Indicators", also: ["/browse", "/series", "/search"] },
  { href: "/library", label: "Library", also: ["/sources", "/datasets", "/tables", "/data"] },
  { href: "/compare", label: "Chart builder" },
  { href: "/answers", label: "Stories" },
  { href: "/about", label: "About", also: ["/methods", "/releases", "/api"] },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const release = db().release;
  const v = release.version;
  // Runs before paint: hides the notice if this visitor dismissed it for this release.
  const noticeScript = `document.documentElement.classList.add("js");try{if(localStorage.getItem("proto-notice-dismissed")===${JSON.stringify(v)})document.documentElement.dataset.protoDismissed="true"}catch(e){}`;
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noticeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="proto-notice" role="note" aria-label="Prototype notice">
          <div className="wrap">
            <p>
              <strong>
                Prototype release <Num kind="version">{v}</Num>.
              </strong>{" "}
              Not yet for citation<span className="long"> in publications; no DOI</span>. <span className="long">The printed document prevails. </span>
              <Link href="/about#disclaimer">Disclaimer</Link>
            </p>
            <DismissNotice version={v} />
          </div>
        </div>
        <header className="site-header">
          <div className="wrap bar">
            <Link href="/" className="brand" aria-label="LUMS DataLab, prototype: home">
              <span className="brand-name">
                LUMS <span>DataLab</span>
              </span>
              <span className="proto-mark">Prototype</span>
            </Link>
            <div className="header-search">
              <SearchDialog indexUrl={`${DATA_BASE}/search.json`} />
            </div>
            <NavLinks items={NAV} />
            <MobileMenu items={NAV} />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="wrap">{children}</div>
        </main>
        <EvidenceSheet />
        {/* Data hub run (2026-11-23): one line on how we check, the release (moved here from the header), the links. */}
        <footer className="site-footer site-footer-slim">
          <div className="wrap">
            <p className="ft-how">
              Every figure links to the government page it was printed on and is published only after fixed arithmetic checks.{" "}
              <Link href="/methods">How we check</Link>
            </p>
            <p className="ft-rel">
              <Link href="/releases" className="ft-tag" title="The data release this site shows">
                Release <Num kind="version">{v}</Num>
              </Link>
              , built <Num kind="date">{dateOnly(release.created_at)}</Num>. Prototype{release.doi ? <>; DOI <Num kind="id">{release.doi}</Num></> : null}. Where
              this site and the printed document differ, the document prevails. Data <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, code MIT.
            </p>
            <nav className="ft-links" aria-label="Footer">
              <Link href="/library">Library</Link>
              <Link href="/data">Downloads and file formats</Link>
              <Link href="/browse">All indicators</Link>
              <Link href="/releases">Releases and corrections</Link>
              <Link href="/methods">Methods</Link>
              <Link href="/api">API</Link>
              <ReportLink issuesUrl={ISSUES_URL} version={v}>
                Report an error on this page
              </ReportLink>
              <a href={REPO_URL}>Source code</a>
              <Link href="/about">About</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
