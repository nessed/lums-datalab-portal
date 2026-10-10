import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { db, ISSUES_URL } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LUMS DataLab Portal (prototype)", template: "%s | LUMS DataLab Portal (prototype)" },
  description:
    "An open research bank of Pakistan's official statistics where every number can be checked against the government page it came from. Unofficial research prototype.",
};

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/demo/health-and-jobs", label: "Demo" },
  { href: "/sources", label: "Sources" },
  { href: "/methods", label: "Methods" },
  { href: "/releases", label: "Releases" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const release = db().release;
  return (
    <html lang="en">
      <body>
        <div className="proto-strip">
          <div className="wrap">
            Unofficial research prototype. The government documents are the authority. <Link href="/about">Read the disclaimer</Link>.
          </div>
        </div>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              LUMS DataLab Portal<small>prototype</small>
            </Link>
            <nav className="site-nav" aria-label="Main">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <p>
              Release <span className="mono">{release.version}</span> ({release.label ?? "prototype"}, {release.doi ? `DOI ${release.doi}` : "no DOI"}).{" "}
              <Link href="/releases">Releases, changelog and errata</Link>.
            </p>
            <p>
              LUMS Department of Economics DataLab (prototype). Unofficial; the government documents are the authority. Data licence CC BY 4.0, code
              licence MIT. <a href={ISSUES_URL}>Report an error</a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
