// FactPills: a strip of label/value pills under a title (like FiscalData's
// dataset pills): period covered, how often published, latest figure date, next
// expected, source document, checked against the printed page.
// Presentational only. Values are NODES, so pass the annotated elements
// themselves and check-build still sees them:
//   <FactPills items={[
//     { label: "Covers", value: <><Num kind="period">2021-22</Num> to <Num kind="period">2026-27</Num></> },
//     { label: "Published", value: "Every year, in June" },
//     { label: "Source", value: <Link href={sourceHref}>Annual Budget Statement</Link> },
//     { label: "Checked", value: <StatusBadge info={...} short /> },
//   ]} />
// Renders a <dl>; on a phone the pills wrap. Styles: .fact-pills in src/styles/base.css.
import type { ReactNode } from "react";

export type Fact = { label: ReactNode; value: ReactNode; key?: string };

export default function FactPills({ items, label, className }: { items: Fact[]; label?: string; className?: string }) {
  const shown = items.filter((f) => f.value !== null && f.value !== undefined && f.value !== false);
  if (!shown.length) return null;
  return (
    <dl className={`fact-pills${className ? ` ${className}` : ""}`} aria-label={label}>
      {shown.map((f, i) => (
        <div className="fact-pill" key={f.key ?? i}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
