// Buttons, chips and segmented tabs. Styles in src/styles/base.css.
//
// Buttons: ONE filled primary per view (LUMS blue, white text), the rest outlined.
//   <ButtonLink href="/data" primary>Download CSV</ButtonLink>
//   <ButtonLink href="#cite">Cite</ButtonLink>
//   For a <button> or a download <a>, use the classes directly: className="btn btn-primary"
//   or "btn btn-secondary" (plain "btn" stays the neutral grey-bordered button).
//
// Chips and segmented tabs are LINKS: the state lives in the URL, so they work
// without JavaScript. The active one gets aria-current and is drawn navy fill +
// white text + gold edge, so the state never depends on gold alone.
//   <Chips label="Range" items={[{ href: "?r=5y", label: "5Y", active: r === "5y" }, ...]} />
//   <SegTabs label="View" items={[{ href: "?v=chart", label: "Chart", active: true }, ...]} />
// Chips wrap onto several lines (filters, topics); SegTabs is one joined control
// (2 to 5 short options: chart/table, ranges).
import Link from "@/components/ui/Link";
import type { ReactNode } from "react";

export function ButtonLink({ href, primary, children, className }: { href: string; primary?: boolean; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`btn ${primary ? "btn-primary" : "btn-secondary"}${className ? ` ${className}` : ""}`}>
      {children}
    </Link>
  );
}

export type ChipItem = { href: string; label: ReactNode; active?: boolean; key?: string };

export function Chips({ label, items, className }: { label: string; items: ChipItem[]; className?: string }) {
  return (
    <nav className={`chips${className ? ` ${className}` : ""}`} aria-label={label}>
      <ul>
        {items.map((c, i) => (
          <li key={c.key ?? c.href ?? i}>
            <Link href={c.href} className="chip" aria-current={c.active ? "true" : undefined} scroll={false}>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SegTabs({ label, items, className }: { label: string; items: ChipItem[]; className?: string }) {
  return (
    <nav className={`segtabs${className ? ` ${className}` : ""}`} aria-label={label}>
      {items.map((c, i) => (
        <Link key={c.key ?? c.href ?? i} href={c.href} className="segtab" aria-current={c.active ? "true" : undefined} scroll={false}>
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
