"use client";
// Home v2 switchers. Every panel is rendered on the server (so every figure is
// in the HTML, linked to its receipt and checked by scripts/check-build.mjs);
// these components only choose which one is visible. The first panel is the
// server's choice, so the page reads the same without JavaScript.
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";

type Opt = { key: string; label: ReactNode };

function readStore(k: string | undefined): string | null {
  if (!k) return null;
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
const onStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
/** The index chosen here, else the one remembered in this browser, else the first (the server's choice). */
function useChoice(storeKey: string | undefined, keys: string[]): [number, (i: number) => void] {
  const stored = useSyncExternalStore(onStorage, () => readStore(storeKey), () => null);
  const [picked, setPicked] = useState<number | null>(null);
  const fromStore = stored ? keys.indexOf(stored) : -1;
  const at = picked ?? (fromStore >= 0 ? fromStore : 0);
  return [
    at,
    (i: number) => {
      setPicked(i);
      if (keys[i] !== undefined) writeStore(storeKey, keys[i]);
    },
  ];
}
function writeStore(k: string | undefined, v: string) {
  if (!k) return;
  try {
    localStorage.setItem(k, v);
  } catch {}
}

/** Arrow keys move along a row of tabs (WAI-ARIA tabs pattern, automatic activation). */
function onArrows(e: React.KeyboardEvent, i: number, n: number, set: (i: number) => void, ids: string[]) {
  const k = e.key;
  let j = -1;
  if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % n;
  else if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + n) % n;
  else if (k === "Home") j = 0;
  else if (k === "End") j = n - 1;
  if (j < 0) return;
  e.preventDefault();
  set(j);
  document.getElementById(ids[j])?.focus();
}

/**
 * Tabs or a segmented control over server-rendered panels. `variant`:
 *   "tabs"  underlined tabs (Just added / Coming up)
 *   "seg"   a segmented control (Chart / Table, the rates board theme)
 */
export function Switch({
  label,
  options,
  panels,
  variant = "tabs",
  className,
  storeKey,
}: {
  label: string;
  options: Opt[];
  panels: ReactNode[];
  variant?: "tabs" | "seg";
  className?: string;
  storeKey?: string;
}) {
  const base = useId();
  const [at, set] = useChoice(
    storeKey,
    options.map((o) => o.key),
  );
  const tabIds = options.map((_, i) => `${base}-t${i}`);
  return (
    <div className={`sw sw-${variant}${className ? ` ${className}` : ""}`}>
      <div className={variant === "seg" ? "seg" : "tabs2"} role="tablist" aria-label={label}>
        {options.map((o, i) => (
          <button
            key={o.key}
            id={tabIds[i]}
            type="button"
            role="tab"
            aria-selected={i === at}
            aria-controls={`${base}-p${i}`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => set(i)}
            onKeyDown={(e) => onArrows(e, i, options.length, set, tabIds)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {panels.map((p, i) => (
        <div key={options[i]?.key ?? i} id={`${base}-p${i}`} role="tabpanel" aria-labelledby={tabIds[i]} hidden={i !== at} className="sw-panel">
          {p}
        </div>
      ))}
    </div>
  );
}

/**
 * The key-number tiles. Each tile is a block whose links (the value to its
 * receipt, the name to its series) work on their own; a full-tile button (the
 * tile's name) selects it and swaps the chart, sentence and source below.
 */
export function TileSwitch({
  label,
  tiles,
  panels,
}: {
  label: string;
  tiles: { key: string; name: ReactNode; body: ReactNode }[];
  panels: ReactNode[];
}) {
  const base = useId();
  const [at, setAt] = useState(0);
  const tabIds = tiles.map((_, i) => `${base}-t${i}`);
  return (
    <div className="kt-wrap">
      <ul className="kt-grid" role="tablist" aria-label={label}>
        {tiles.map((t, i) => (
          <li key={t.key} className="kt" data-active={i === at ? "" : undefined} role="presentation">
            <button
              id={tabIds[i]}
              type="button"
              role="tab"
              className="kt-pick"
              aria-selected={i === at}
              aria-controls={`${base}-p${i}`}
              tabIndex={i === at ? 0 : -1}
              onClick={() => setAt(i)}
              onKeyDown={(e) => onArrows(e, i, tiles.length, setAt, tabIds)}
            >
              {t.name}
            </button>
            <div className="kt-body">{t.body}</div>
          </li>
        ))}
      </ul>
      {panels.map((p, i) => (
        <div key={tiles[i]?.key ?? i} id={`${base}-p${i}`} role="tabpanel" aria-labelledby={tabIds[i]} hidden={i !== at} className="kp">
          {p}
        </div>
      ))}
    </div>
  );
}

/** A labelled select over server-rendered panels; the choice is remembered in this browser (localStorage). */
export function SelectSwitch({
  id,
  label,
  options,
  panels,
  storeKey,
}: {
  id: string;
  label: string;
  options: { key: string; label: string }[];
  panels: ReactNode[];
  storeKey?: string;
}) {
  const [at, setAt] = useChoice(
    storeKey,
    options.map((o) => o.key),
  );
  return (
    <div className="selsw">
      <label htmlFor={id} className="selsw-l">
        {label}
      </label>
      <select
        id={id}
        className="selsw-s"
        value={options[at]?.key}
        onChange={(e) => {
          const i = options.findIndex((o) => o.key === e.target.value);
          if (i >= 0) setAt(i);
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <div aria-live="polite">
        {panels.map((p, i) => (
          <div key={options[i]?.key ?? i} hidden={i !== at}>
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * What it costs you: an amount (segmented, labels from the server because they
 * hold digits) and a price group (select). Panels are keyed "amount|group".
 */
export function CostSwitch({
  amounts,
  groups,
  panels,
  amountLabel = "Amount",
}: {
  amounts: { key: string; label: ReactNode }[];
  groups: { key: string; label: string; rate?: ReactNode; w?: string }[];
  panels: Record<string, ReactNode>;
  amountLabel?: string;
}) {
  const base = useId();
  const [a, setA] = useState(0);
  const [g, setG] = useState(0);
  const ids = amounts.map((_, i) => `${base}-a${i}`);
  const key = `${amounts[a]?.key}|${groups[g]?.key}`;
  return (
    <div className="cost-sw">
      <div className="cost-ctl">
        <div className="cost-ctl-a">
          <span className="selsw-l" id={`${base}-al`}>
            {amountLabel}
          </span>
          <div className="seg" role="radiogroup" aria-labelledby={`${base}-al`}>
            {amounts.map((o, i) => (
              <button
                key={o.key}
                id={ids[i]}
                type="button"
                role="radio"
                aria-checked={i === a}
                tabIndex={i === a ? 0 : -1}
                onClick={() => setA(i)}
                onKeyDown={(e) => onArrows(e, i, amounts.length, setA, ids)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cost-ctl-g">
        <span className="selsw-l" id={`${base}-gl`}>
          Pick what you buy
        </span>
        <div className="cost-groups" role="radiogroup" aria-labelledby={`${base}-gl`}>
          {groups.map((o, i) => (
            <button
              key={o.key}
              id={`${base}-g${i}`}
              type="button"
              role="radio"
              aria-checked={i === g}
              tabIndex={i === g ? 0 : -1}
              className="cost-g"
              onClick={() => setG(i)}
              onKeyDown={(e) => onArrows(e, i, groups.length, setG, groups.map((_, j) => `${base}-g${j}`))}
            >
              <span className="cost-g-name">{o.label}</span>
              {o.w ? (
                <span className="cost-g-bar" aria-hidden="true">
                  <span style={{ width: o.w }} />
                </span>
              ) : null}
              {o.rate ? <span className="cost-g-rate">{o.rate}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite">
        {Object.entries(panels).map(([k, p]) => (
          <div key={k} hidden={k !== key}>
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
