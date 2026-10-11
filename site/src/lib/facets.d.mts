import type { Series } from "./data";

export type FacetKey = "dataset" | "topic" | "geo" | "definition" | "side" | "sex" | "area" | "measure" | "base" | "frequency" | "unit";
export const FACETS: { key: FacetKey; label: string; open: boolean; more?: number }[];
export function topicKey(s: Series): string | null;
export function topicLabels(series: Series[]): Map<string, string>;
export function facetValuesOf(s: Series): Record<FacetKey, string | null>;
export function valueWords(facet: FacetKey, value: string, topics?: Map<string, string>, datasets?: Record<string, string>): string;
export function facetCounts(series: Series[]): Record<FacetKey, Map<string, number>>;
