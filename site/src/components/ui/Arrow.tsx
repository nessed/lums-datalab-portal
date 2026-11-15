// Arrow: up, down or flat, drawn as a small SVG triangle (Noto Sans has no arrow
// glyphs) in the surrounding ink colour: never red or green. The words are
// visually hidden for screen readers; pass label={false} when the visible text
// beside it already says "up" or "down".
//   <Arrow dir="up" label={false} /> up <span ...>17.1%</span> on the 2025-26 budget estimate
//   <Arrow dir="down" />              (reads "down")
import type { ReactNode } from "react";

export type ArrowDir = "up" | "down" | "flat";
const WORDS: Record<ArrowDir, string> = { up: "up", down: "down", flat: "no change" };

export default function Arrow({ dir, label }: { dir: ArrowDir; label?: ReactNode | false }) {
  const d = dir === "up" ? "M5 1.5 9.5 8.5H.5z" : dir === "down" ? "M5 8.5.5 1.5h9z" : "M.5 3.5h9v3h-9z";
  return (
    <span className={`arrow arrow--${dir}`}>
      <svg viewBox="0 0 10 10" width="0.7em" height="0.7em" aria-hidden="true" focusable="false">
        <path d={d} fill="currentColor" />
      </svg>
      {label === false ? null : <span className="sr-only">{label ?? WORDS[dir]}</span>}
    </span>
  );
}
