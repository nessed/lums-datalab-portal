// PrintedPagePill: "See it on the printed page", navy text on a gold pill, a
// link to the figure's receipt (the crop of the government page). Page agents
// place it next to a headline figure. `sheet` (the slugified obs id) opens the
// one-tap evidence sheet instead of leaving the page when JavaScript runs.
//   <PrintedPagePill href={obsHref(o.obs_id)} sheet={slugify(o.obs_id)} />
//   <PrintedPagePill href={...}>Printed on page <Num kind="page">11</Num></PrintedPagePill>
// Styles: .printed-pill in src/styles/base.css (contrast checked in scripts/contrast.mjs).
import Link from "@/components/ui/Link";
import type { ReactNode } from "react";
import { IconPage } from "./Icons";

export default function PrintedPagePill({ href, sheet, children, className }: { href: string; sheet?: string; children?: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`printed-pill${className ? ` ${className}` : ""}`} {...(sheet ? { "data-sheet": sheet } : {})}>
      <IconPage />
      <span>{children ?? "See it on the printed page"}</span>
    </Link>
  );
}
