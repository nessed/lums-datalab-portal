// Breadcrumb under the header on inner pages (Home v3 pages set, 2026-11-24).
// The last item is the current page and is not a link.
import Link from "@/components/ui/Link";
import type { ReactNode } from "react";

export type Crumb = { href?: string; label: ReactNode };

export default function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        {items.map((c, i) => (
          <li key={i}>
            {c.href && i < items.length - 1 ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
