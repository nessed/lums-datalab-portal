"use client";
// The one-tap evidence sheet (DESIGN.md section 7, "One tap"): a bottom sheet on
// phones, a popover on desktop, opened from any value link marked data-sheet.
// STUB: renders nothing, so data-sheet links navigate to the full receipt as
// plain links. The evidence stage replaces this body. Contract:
//   - mounted once in the layout;
//   - intercepts clicks on a[data-sheet] (the attribute holds the figure's slug);
//   - the open sheet is in the URL as ?fig=<slug>; Back closes it;
//   - focus is trapped inside, Escape closes, focus returns to the link.
export default function EvidenceSheet() {
  return null;
}
