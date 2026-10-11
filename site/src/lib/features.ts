// Planned features, one flag each (site/features.config.json). While a flag
// is off its slot says "Coming: not in this release". None of them is built
// yet, so turning a flag on fails the build here: a flag must never switch on
// an empty view or one filled with invented values.
import config from "../../features.config.json";

export type FeatureKey = "realTerms" | "percentOfGdp" | "api" | "maps" | "districts" | "provincialBudgets" | "moreDataTypes" | "monthlyData" | "errataBadges";

type Entry = { enabled: boolean; label: string };
const FEATURES = config as unknown as Record<FeatureKey, Entry>;

/** Features that have an implementation behind their flag. Empty for now. */
const IMPLEMENTED: FeatureKey[] = [];

for (const [k, v] of Object.entries(FEATURES)) {
  if (k.startsWith("$")) continue;
  if (v.enabled && !IMPLEMENTED.includes(k as FeatureKey)) {
    throw new Error(`features.config.json: "${k}" is switched on but not built. See docs/OPEN_WORK.md (S16) for what it needs.`);
  }
}

export const COMING = "Coming: not in this release";

export function feature(k: FeatureKey): Entry {
  return FEATURES[k];
}

export function isOn(k: FeatureKey): boolean {
  return !!FEATURES[k]?.enabled;
}
