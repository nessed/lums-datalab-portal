"use client";
// Small client pieces of the page chrome: the active nav item, the dismissible
// prototype notice, and the "Report an error" link that names the current page.
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname() ?? "/";
  return (
    <nav className="site-nav" aria-label="Main">
      {items.map((n) => {
        const active = path === n.href || path.startsWith(`${n.href}/`);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}>
            {n.label}
          </Link>
        );
      })}
    </nav>
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
