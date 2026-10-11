// Small server-side building blocks. Class names are defined in globals.css.
import Link from "next/link";
import type { ReactNode } from "react";
import { IconDownload, IconExternal } from "./Icons";

export type Crumb = { href?: string; label: ReactNode };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={i}>
            {c.href && i < items.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Callout({ kind = "plain", title, children }: { kind?: "plain" | "caveat" | "disputed" | "ok" | "note"; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`callout${kind === "plain" ? "" : ` callout--${kind}`}`}>
      {title ? <p className="callout-title">{title}</p> : null}
      {children}
    </div>
  );
}

export function Disclosure({ summary, meta, open, children, id }: { summary: ReactNode; meta?: ReactNode; open?: boolean; children: ReactNode; id?: string }) {
  return (
    <details className="disclosure" open={open} id={id}>
      <summary>
        <span>{summary}</span>
        {meta ? <span className="summary-meta">{meta}</span> : null}
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

/** A scrollable table region: focusable so keyboard users can scroll it, and named. */
export function TableWrap({ label, children, tall, sticky }: { label: string; children: ReactNode; tall?: boolean; sticky?: boolean }) {
  return (
    <div className={`table-wrap${tall ? " is-tall" : ""}${sticky ? " dt-sticky" : ""}`} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function DownloadLink({ href, children, className = "btn", filename }: { href: string; children: ReactNode; className?: string; filename?: string }) {
  return (
    <a className={className} href={href} download={filename ?? true}>
      <IconDownload />
      <span>{children}</span>
    </a>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={href} rel="noopener">
      {children}
      <span className="sr-only"> (external site)</span>
      {className?.includes("btn") ? <IconExternal /> : null}
    </a>
  );
}

export type TocItem = { id: string; label: ReactNode; sub?: boolean };

export function Toc({ items, label = "On this page" }: { items: TocItem[]; label?: string }) {
  return (
    <nav className="toc" aria-label={label}>
      <h2>{label}</h2>
      <ol>
        {items.map((t) => (
          <li key={t.id} className={t.sub ? "toc-sub" : undefined}>
            <a href={`#${t.id}`}>{t.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Thin bar with the number beside it (coverage, pass rates). Ratio 0..1. */
export function Bar({ ratio, label }: { ratio: number | null | undefined; label: string }) {
  const r = ratio === null || ratio === undefined || Number.isNaN(ratio) ? null : Math.max(0, Math.min(1, ratio));
  return (
    <span className="bar">
      <span className="bar-track" aria-hidden="true">
        {r !== null ? <span className="bar-fill" style={{ width: `${(r * 100).toFixed(1)}%` }} /> : null}
      </span>
      <span>{label}</span>
    </span>
  );
}
