// The guides (2026-11-23): short explainers of how to read the figures. Editorial
// text written by people or agents, never data: no digits here (every figure a
// guide shows is read from the release on its page). PROVISIONAL: drafted by an
// agent from the Guide design; Ali and Ahmad confirm or replace the wording.

export type Guide = { slug: string; title: string; summary: string; section: string };

/** Guides that are written, in the order the index lists them. */
export const GUIDES: Guide[] = [
  {
    slug: "revised-estimate",
    title: "What is a revised estimate?",
    summary: "The budget gives two figures for most years: the plan, and an updated figure a year later. How to tell them apart.",
    section: "Reading the budget",
  },
];

/** Guides being written: named, not linked. */
export const GUIDES_COMING: string[] = [
  "Why the price index has a base year",
  "What the eighteenth amendment moved to the provinces",
  "Why some Labour Force Survey tables are printed twice",
];

export const guideHref = (slug: string) => `/guides/${slug}`;
