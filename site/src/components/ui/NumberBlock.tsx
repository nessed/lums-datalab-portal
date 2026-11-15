// NumberBlock: the headline block for one figure (StatsNZ indicator, ONS cards,
// USAFacts answers). Top to bottom:
//   label   small line: the kind of figure and the period, in words
//   value   the big number, Noto Sans Display Bold, navy, tabular figures
//   answer  one plain sentence on a gold-tinted highlight (text stays ink)
//   change  smaller: an <Arrow/> and words, neutral ink ("up 17.1% on the 2025-26 budget estimate")
//   children  anything else (a PrintedPagePill, a caveat that changes how the number reads)
// Presentational: it receives nodes and computes nothing. Pass the value as the
// V node itself so it stays a receipt link that check-build can trace:
//   <NumberBlock
//     label={<>Budget estimate, <Num kind="period">2026-27</Num></>}
//     value={<V o={obs} short />}
//     answer={<>The federal government plans to spend ... on health.</>}
//     change={<><Arrow dir="up" label={false} /> up <span data-num="derived" ...>17.1%</span> on the ...</>}
//   >
//     <PrintedPagePill href={obsHref(obs.obs_id)} />
//   </NumberBlock>
// size="l" gives the smaller card size (home cards, lists of headline figures).
// Styles: .numblock in src/styles/base.css.
import type { ReactNode } from "react";

export default function NumberBlock({
  label,
  value,
  answer,
  change,
  children,
  size = "xl",
  className,
}: {
  label?: ReactNode;
  value: ReactNode;
  answer?: ReactNode;
  change?: ReactNode;
  children?: ReactNode;
  size?: "xl" | "l";
  className?: string;
}) {
  return (
    <div className={`numblock numblock--${size}${className ? ` ${className}` : ""}`}>
      {label ? <p className="numblock-label">{label}</p> : null}
      <p className="numblock-value">{value}</p>
      {answer ? (
        <p className="numblock-answer">
          <span>{answer}</span>
        </p>
      ) : null}
      {change ? <p className="numblock-change">{change}</p> : null}
      {children}
    </div>
  );
}
