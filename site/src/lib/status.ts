// The status system on screen. The adapter decides each figure's reader
// status (src/lib/adapter, DESIGN.md 6.1); this file only says how each one
// looks: a visual key with a colour AND a shape, a short label and one
// sentence. Every badge, table cell, chart point and legend reads from here.
//
// Values from a newer release that this code does not know map to "unknown":
// shown with their raw label in a neutral style, never a crash and never
// dressed up as checked.
import type { ReaderStatus, ReaderStatusKey } from "./adapter/contract";

export type StatusKey = "checked" | "candidate" | "disputed" | "gap-source" | "dash-or-zero" | "gap-pending" | "withheld" | "unknown";

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
  candidate: {
    key: "candidate",
    label: "Not signed off",
    meaning: "The figure passed its checks, but a person has not yet approved the dataset it belongs to. Kept out of headlines.",
  },
  disputed: {
    key: "disputed",
    label: "Disputed",
    meaning: "Two official documents print different figures for the same line and year, and each adds up in its own table. Both are shown on the receipt; neither is presented as the answer.",
  },
  "gap-source": {
    key: "gap-source",
    label: "Not printed",
    meaning: "The document prints a dash or a blank here, not a number. We do not read a dash as zero.",
  },
  "dash-or-zero": {
    key: "dash-or-zero",
    label: "Dash or zero",
    meaning: "The source stored 0 for a printed dash or zero and does not say which, so no number is shown and it is never used in a sum.",
  },
  "gap-pending": {
    key: "gap-pending",
    label: "Not checked yet",
    meaning: "We have read this figure but no check covers it yet. We show a gap rather than an unchecked number.",
  },
  withheld: {
    key: "withheld",
    label: "Held back",
    meaning: "A figure was read but failed its checks, and nothing independent says which number is wrong. We do not guess.",
  },
};

/** Order used in legends. */
export const STATUS_ORDER: Exclude<StatusKey, "unknown">[] = ["checked", "candidate", "disputed", "gap-source", "dash-or-zero", "gap-pending", "withheld"];

/** Tier in words, for the "checked" status when it is expanded. */
export const TIER_SHORT: Record<string, string> = {
  A: "verified by a sum and a second printing",
  B: "verified by a sum or a second printing",
};

const VISUAL: Record<ReaderStatusKey, StatusKey> = {
  checked: "checked",
  "checked-note": "checked",
  revised: "checked",
  candidate: "candidate",
  disputed: "disputed",
  held: "withheld",
  "not-checked": "gap-pending",
  "not-printed": "gap-source",
  "dash-or-zero": "dash-or-zero",
  unknown: "unknown",
};

/** The visual key for an adapter's reader status. */
export function visualKey(r: Pick<ReaderStatus, "key">): StatusKey {
  return VISUAL[r.key] ?? "unknown";
}

type StatusInput = { reader?: ReaderStatus | null; status?: string | null; published?: boolean; value?: string | null; gap_kind?: string | null };

/** How a figure is shown. Reads the adapter's decision (o.reader); never re-decides it. */
export function statusOf(o: StatusInput | null | undefined): StatusInfo {
  if (!o) return { key: "unknown", label: "Not in this release", meaning: "This release holds no record for this figure." };
  if (!o.reader) {
    // A record that did not come through the adapter: never shown as checked.
    return { key: "unknown", label: "No value", meaning: "This record did not come through the data adapter, so no value is shown." };
  }
  const k = visualKey(o.reader);
  if (k === "unknown") {
    const raw = [o.status, o.gap_kind].filter(Boolean).join(", ").replaceAll("_", " ");
    return { key: "unknown", label: raw || "No value", meaning: o.reader.reason };
  }
  if ((k === "checked" || k === "candidate") && (!o.published || o.value === null || o.value === undefined)) {
    return { key: "unknown", label: "No value", meaning: "This release holds no value for this figure." };
  }
  return STATUS[k];
}

/** Status of a dataset as a whole, from release.json dataset_status[k].state. */
export function datasetStateWords(state: string | null | undefined): string {
  if (state === "published") return "Published";
  if (state === "candidate") return "Not signed off";
  if (state === "coming" || !state) return "Coming";
  return state.replaceAll("_", " ");
}
