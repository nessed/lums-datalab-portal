"use client";
// Small client pieces of the page chrome: the active nav item, the dismissible
// prototype notice, and the "Report an error" link that names the current page.
import Link from "@/components/ui/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string; also?: string[] };

const isActive = (path: string, n: NavItem) =>
  [n.href, ...(n.also ?? [])].some((h) => path === h || path.startsWith(`${h}/`));

export function NavLinks({ items, className = "site-nav" }: { items: NavItem[]; className?: string }) {
  const path = usePathname() ?? "/";
  return (
    <nav className={className} aria-label="Main">
      {items.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(path, n) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phones: the same links behind a "Menu" button. A <details> element, so it
 * works without JavaScript; it closes itself after a navigation. */
export function MobileMenu({ items }: { items: NavItem[] }) {
  const path = usePathname() ?? "/";
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  return (
    <details className="nav-menu" ref={ref}>
      <summary>Menu</summary>
      <nav aria-label="Main (menu)">
        {items.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(path, n) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
        <Link href="/releases" aria-current={path.startsWith("/releases") ? "page" : undefined}>
          Releases and errata
        </Link>
        <Link href="/data" aria-current={path.startsWith("/data") ? "page" : undefined}>
          Download and file formats
        </Link>
      </nav>
    </details>
  );
}

/** Dismissal is remembered per release version. A tiny inline script in the
 * layout hides the notice before first paint if it was dismissed. */
export function DismissNotice({ version }: { version: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem("proto-notice-dismissed", version);
        } catch {}
        document.documentElement.dataset.protoDismissed = "true";
      }}
    >
      Hide<span className="sr-only"> this notice</span>
    </button>
  );
}

export function ReportLink({ issuesUrl, version, children }: { issuesUrl: string; version: string; children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const title = `Error report: ${decodeURIComponent(path)}`;
  const body = `Page: ${decodeURIComponent(path)}\nRelease: ${version}\n\nWhat looks wrong (the figure, the box, a label, a link):\n\nWhat the government document says (document, page):\n`;
  const href = `${issuesUrl}/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return <a href={href}>{children}</a>;
}

/** "Is this page useful?" (Home v2 footer). The prototype stores nothing: a
 * click says so and points to the error report, which is the one channel that
 * reaches us. */
export function UsefulPrompt({ issuesUrl, version }: { issuesUrl: string; version: string }) {
  const [said, setSaid] = useState<"" | "yes" | "no">("");
  return (
    <div className="fb-row">
      {said ? (
        <p className="fb-thanks" role="status">
          Thank you. This prototype does not record answers yet.{" "}
          {said === "no" ? (
            <>
              To tell us what was missing or wrong, <ReportLink issuesUrl={issuesUrl} version={version}>report it here</ReportLink>.
            </>
          ) : null}
        </p>
      ) : (
        <>
          <p className="fb-q" id="fb-q">
            Is this page useful?
          </p>
          <div className="fb-btns" role="group" aria-labelledby="fb-q">
            <button type="button" onClick={() => setSaid("yes")}>
              Yes
            </button>
            <button type="button" onClick={() => setSaid("no")}>
              No
            </button>
          </div>
        </>
      )}
      <span className="fb-report">
        <ReportLink issuesUrl={issuesUrl} version={version}>
          Report an error on this page
        </ReportLink>
      </span>
    </div>
  );
}
