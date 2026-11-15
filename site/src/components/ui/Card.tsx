// Cards and panels: white on the grey page ground, a hairline border, radius 6 px
// at most, no heavy shadow. Use a Card for a self-contained block (a figure, a
// search result, a topic); a Panel for a full-width region of a page (the chart
// with its tools, a table). Styles: .card / .panel in src/styles/base.css.
//   <Card title="Federal health spending" titleAs="h3">...</Card>
//   <Panel label="Chart">...</Panel>   (label names the region for screen readers)
// Both are server components and need no JavaScript.
import type { ReactNode } from "react";

type HeadingTag = "h2" | "h3" | "h4";

export function Card({
  title,
  titleAs: H = "h3",
  meta,
  children,
  className,
  as: Tag = "div",
}: {
  title?: ReactNode;
  titleAs?: HeadingTag;
  /** One line of metadata under the title (period, kind, source), in metadata grey. */
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag className={`card${className ? ` ${className}` : ""}`}>
      {title ? <H className="card-title">{title}</H> : null}
      {meta ? <p className="card-meta">{meta}</p> : null}
      {children}
    </Tag>
  );
}

export function Panel({ label, children, className, flush }: { label?: string; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`panel${flush ? " panel--flush" : ""}${className ? ` ${className}` : ""}`} aria-label={label}>
      {children}
    </section>
  );
}
