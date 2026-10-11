// The status system. One function decides how an observation is shown; every
// badge, table cell, chart point and legend reads from here, so a status means
// the same thing, in the same colour and shape, everywhere on the site.
//
// Values from a newer release that this code does not know (a new status or
// gap kind) map to "unknown": shown with their raw label in a neutral style,
// never a crash and never dressed up as checked.

export type StatusKey = "checked" | "disputed" | "gap-source" | "gap-pending" | "withheld" | "unknown";

export type StatusInfo = {
  key: StatusKey;
  /** Short label for badges and table cells. */
  label: string;
  /** One sentence: what this means for the reader. */
  meaning: string;
};

export const STATUS: Record<Exclude<StatusKey, "unknown">, StatusInfo> = {
  checked: {
    key: "checked",
    label: "Checked",
    meaning: "Read from the government page and confirmed by at least one arithmetic or cross-edition check.",
  },
  disputed: {
    key: "disputed",
    label: "Disputed",
    meaning: "Two official printings disagree, and each adds up in its own table. Both are shown on the receipt; neither is presented as the answer.",
  },
  "gap-source": {
    key: "gap-source",
    label: "Not published by the government",
    meaning: "The government document prints no number here (a dash or a blank), so there is no value to show.",
  },
  "gap-pending": {
    key: "gap-pending",
    label: "Not yet verified by us",
    meaning: "The figure may be printed, but it has not passed our checks yet. We show a gap rather than an unchecked number.",
  },
  withheld: {
    key: "withheld",
    label: "Withheld",
    meaning: "A figure was read but failed its checks, and nothing independent says which number is wrong. We do not guess.",
  },
};

/** Order used in legends. */
export const STATUS_ORDER: Exclude<StatusKey, "unknown">[] = ["checked", "disputed", "gap-source", "gap-pending", "withheld"];

/** Tier in words, for the "checked" status when it is expanded. */
export const TIER_SHORT: Record<string, string> = {
  A: "verified by a sum and a second printing",
  B: "verified by a sum or a second printing",
};

type StatusInput = { status?: string | null; published?: boolean; value?: string | null; gap_kind?: string | null };

export function statusOf(o: StatusInput | null | undefined): StatusInfo {
  if (!o) return { key: "unknown", label: "Not in this release", meaning: "This release holds no record for this figure." };
  if (o.status === "disputed") return STATUS.disputed;
  if (o.status === "checked" && o.published && o.value !== null && o.value !== undefined) return STATUS.checked;
  switch (o.gap_kind) {
    case "not_in_source":
      return STATUS["gap-source"];
    case "not_yet_verified":
      return STATUS["gap-pending"];
    case "failed_checks":
      return STATUS.withheld;
  }
  const raw = [o.status, o.gap_kind].filter(Boolean).join(", ").replaceAll("_", " ");
  return {
    key: "unknown",
    label: raw || "No value",
    meaning: "This release uses a status this page does not describe yet. No value is shown.",
  };
}

/** Status of a dataset as a whole, from release.json dataset_status[k].state. */
export function datasetStateWords(state: string | null | undefined): string {
  if (state === "published") return "Published";
  if (state === "coming" || !state) return "Coming";
  return state.replaceAll("_", " ");
}
