import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { NavLinks, DismissNotice, ReportLink, MobileMenu } from "@/components/chrome/Chrome";
import { Num } from "@/components/ui/Num";
import { COMING } from "@/lib/features";
import SearchDialog from "@/components/chrome/SearchDialog";
import { DATA_BASE, db, ISSUES_URL, REPO_URL, SITE_URL } from "@/lib/data";
import { dateOnly } from "@/lib/format";
import "./globals.css";

// Self-hosted (OFL) so the build needs no network and there is no layout shift.
const serif = localFont({
  src: [
    { path: "../fonts/source-serif-4-latin-opsz-normal.woff2", style: "normal", weight: "200 900" },
  ],
  variable: "--font-source-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
const sans = localFont({
  src: [
    { path: "../fonts/source-sans-3-latin-wght-normal.woff2", style: "normal", weight: "200 900" },
  ],
  variable: "--font-source-sans",
  display: "swap",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "LUMS DataLab: Pakistan's official statistics, checked (prototype)", template: "%s · LUMS DataLab (prototype)" },
  description:
    "A research bank of Pakistan's economic and fiscal data in which every number links to the spot on the government page it came from and the checks it passed. Unofficial research prototype.",
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
};

const NAV = [
  { href: "/browse", label: "Data", also: ["/series", "/o", "/datasets", "/tables"] },
  { href: "/compare", label: "Compare" },
  { href: "/sources", label: "Sources" },
  { href: "/methods", label: "Methods" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const release = db().release;
  const v = release.version;
  // Runs before paint: hides the notice if this visitor dismissed it for this release.
  const noticeScript = `document.documentElement.classList.add("js");try{if(localStorage.getItem("proto-notice-dismissed")===${JSON.stringify(v)})document.documentElement.dataset.protoDismissed="true"}catch(e){}`;
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
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
              <span className="long">No DOI; </span>not yet for citation<span className="long"> in publications</span>. <span className="long">The printed document prevails. </span>
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
            <Link href="/releases" className="release-tag" title="The data release this site shows">
              Release <Num kind="version">{v}</Num>
            </Link>
            <MobileMenu items={NAV} />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <section aria-labelledby="ft-what">
              <h2 id="ft-what">LUMS DataLab Portal</h2>
              <p>
                <strong>
                  Prototype release <Num kind="version">{v}</Num>
                </strong>
                , built <Num kind="date">{dateOnly(release.created_at)}</Num>. {release.doi ? <>DOI <Num kind="id">{release.doi}</Num>.</> : "No DOI yet."} Not yet for
                citation in publications. An unofficial research project of the LUMS Department of Economics DataLab. Figures are compiled from official
                publications; where this site and the printed document differ, the document prevails.
              </p>
              <p>
                Data <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, code MIT. No language model writes a published number or
                decides whether it passes a check.
              </p>
            </section>
            <section aria-labelledby="ft-use">
              <h2 id="ft-use">Use the data</h2>
              <ul>
                <li>
                  <Link href="/browse">The catalogue</Link>
                </li>
                <li>
                  <Link href="/data">Download and file formats</Link>
                </li>
                <li>
                  <Link href="/api">API</Link> <span className="coming-inline">{COMING}</span>
                </li>
                <li>
                  <Link href="/releases">Releases, changelog and errata</Link>
                </li>
                <li>
                  <Link href="/demo/health-and-jobs">Worked example</Link>
                </li>
              </ul>
            </section>
            <section aria-labelledby="ft-help">
              <h2 id="ft-help">Check and correct</h2>
              <ul>
                <li>
                  <ReportLink issuesUrl={ISSUES_URL} version={v}>
                    Report an error on this page
                  </ReportLink>
                </li>
                <li>
                  <Link href="/methods">Methods and quality numbers</Link>
                </li>
                <li>
                  <a href={REPO_URL}>Source code and pipeline</a>
                </li>
                <li>
                  <Link href="/about">About the project</Link>
                </li>
              </ul>
            </section>
          </div>
        </footer>
      </body>
    </html>
  );
}
