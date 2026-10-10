// The status system on screen. Every status has a colour AND a shape, so it
// reads in greyscale print and without colour vision:
//   checked      solid disc
//   disputed     hollow ring (thick)
//   gap-source   hatched square   (not published by the government)
//   gap-pending  dotted square    (not yet verified by us)
//   withheld     crossed square   (failed checks)
//   unknown      short dash       (a value this code does not know: raw label)
import { STATUS, STATUS_ORDER, statusOf, TIER_SHORT, type StatusInfo, type StatusKey } from "@/lib/status";

export function StatusMark({ k, title }: { k: StatusKey; title?: string }) {
  const common = { className: "st-mark", viewBox: "0 0 10 10", "aria-hidden": title ? undefined : true, role: title ? "img" : undefined } as const;
  const t = title ? <title>{title}</title> : null;
  switch (k) {
    case "checked":
      return (
        <svg {...common}>
          {t}
          <circle cx="5" cy="5" r="4.2" fill="currentColor" />
        </svg>
      );
    case "disputed":
      return (
        <svg {...common}>
          {t}
          <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "gap-source":
      return (
        <svg {...common}>
          {t}
          <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M0.6 6.6 L6.6 0.6 M3.4 9.4 L9.4 3.4" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
    case "gap-pending":
      return (
        <svg {...common}>
          {t}
          <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.2 1.4" />
        </svg>
      );
    case "withheld":
      return (
        <svg {...common}>
          {t}
          <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M2.4 2.4 L7.6 7.6 M7.6 2.4 L2.4 7.6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {t}
          <path d="M1.5 5 L8.5 5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}

/** Mark + label. `tier` adds the tier in words to a checked status. */
export function StatusBadge({ info, tier, short }: { info: StatusInfo; tier?: string | null; short?: boolean }) {
  const label = short && info.key.startsWith("gap") ? "Gap" : info.label;
  return (
    <span className={`st st--${info.key}`} title={info.meaning}>
      <StatusMark k={info.key} />
      <span className="st-label">
        {label}
        {info.key === "checked" && tier && TIER_SHORT[tier] ? <span className="muted" style={{ fontWeight: 400 }}>{`: ${TIER_SHORT[tier]}`}</span> : null}
      </span>
    </span>
  );
}

/** Convenience: badge straight from an observation-like record. */
export function ObsStatus({ obs, tier, short }: { obs: Parameters<typeof statusOf>[0]; tier?: boolean; short?: boolean }) {
  return <StatusBadge info={statusOf(obs)} tier={tier ? (obs?.status === "checked" ? (obs as { tier?: string | null }).tier : null) : null} short={short} />;
}

const FILL_CLASS: Partial<Record<StatusKey, string>> = {
  "gap-source": "fill-gap-source",
  "gap-pending": "fill-gap-pending",
  withheld: "fill-withheld",
  disputed: "fill-disputed",
};

/** The legend. `compact` is one line for above a table; `full` explains each status. */
export function StatusLegend({ only, full, label = "Status key" }: { only?: StatusKey[]; full?: boolean; label?: string }) {
  const keys = STATUS_ORDER.filter((k) => !only || only.includes(k));
  return (
    <ul className={`status-legend${full ? " is-full" : ""}`} aria-label={label}>
      {keys.map((k) => {
        const info = STATUS[k];
        return (
          <li key={k}>
            <span className={`st st--${k}`}>
              <StatusMark k={k} />
              <span className="st-label">{info.label}</span>
              {!full && FILL_CLASS[k] && k !== "disputed" ? <span className={`swatch ${FILL_CLASS[k]}`} aria-hidden="true" /> : null}
            </span>
            {full ? <span className="muted">{info.meaning}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function cellFillClass(k: StatusKey): string {
  switch (k) {
    case "gap-source":
      return "cell-gap-source";
    case "gap-pending":
      return "cell-gap-pending";
    case "withheld":
      return "cell-withheld";
    case "disputed":
      return "cell-disputed";
    default:
      return "";
  }
}
