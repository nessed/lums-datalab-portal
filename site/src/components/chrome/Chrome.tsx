"use client";
// Small client pieces of the page chrome: the active nav item, the About menu,
// the header search (not on the home page, which has the large one), the
// dismissible prototype notice, and the "Report an error" link that names the
// current page.
import Link from "@/components/ui/Link";
import SearchDialog from "@/components/chrome/SearchDialog";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type NavItem = { href: string; label: string; also?: string[] };

const isActive = (path: string, n: NavItem) =>
  [n.href, ...(n.also ?? [])].some((h) => path === h || path.startsWith(`${h}/`));

export function NavLinks({ items, className = "site-nav", children }: { items: NavItem[]; className?: string; children?: ReactNode }) {
  const path = usePathname() ?? "/";
  return (
    <nav className={className} aria-label="Main">
      {items.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(path, n) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
      {children}
    </nav>
  );
}

const pathOf = (href: string) => href.split("#")[0];

/** A header menu ("Tools", "About"): a <details>, so it works without
 * JavaScript. It closes after a navigation, on Escape and on a click outside.
 * `on` lists the addresses under which the menu shows as the current section. */
export function NavMenu({ label, items, on = [] }: { label: string; items: NavItem[]; on?: string[] }) {
  const path = usePathname() ?? "/";
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  useEffect(() => {
    const shut = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("click", shut);
    document.addEventListener("keydown", shut);
    return () => {
      document.removeEventListener("click", shut);
      document.removeEventListener("keydown", shut);
    };
  }, []);
  const current = on.some((h) => path === h || path.startsWith(`${h}/`));
  return (
    <details className="about-menu" ref={ref}>
      <summary data-current={current ? "page" : undefined}>{label}</summary>
      <ul>
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href} aria-current={n.href.includes("#") ? undefined : path === pathOf(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Kept for callers of the Home v3 name. */
export function AboutMenu({ items }: { items: NavItem[] }) {
  return <NavMenu label="About" items={items} on={["/about", "/methods"]} />;
}

/** The search field in the header, on every page but the home page. */
export function HeaderSearch({ indexUrl }: { indexUrl: string }) {
  const path = usePathname() ?? "/";
  if (path === "/") return null;
  return (
    <div className="mast-search">
      <SearchDialog indexUrl={indexUrl} variant="head" />
    </div>
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
