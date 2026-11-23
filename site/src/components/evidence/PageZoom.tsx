"use client";
// Zoom for the printed page on a receipt (Home v3 pages set, 2026-11-24): minus
// and plus buttons that widen the page inside its scrolling tray. The page, its
// box and its bands scale together (all are positioned in per cent). Without
// JavaScript the buttons are not drawn and the page fits the tray.
import { useEffect, useState, useSyncExternalStore } from "react";

const STEPS = [100, 125, 150, 200, 250];
const noop = () => () => {};

export default function PageZoom({ target }: { target: string }) {
  const js = useSyncExternalStore(noop, () => true, () => false);
  const [i, setI] = useState(0);
  useEffect(() => {
    const el = document.getElementById(target);
    if (el) el.style.width = `${STEPS[i]}%`;
  }, [i, target]);
  if (!js) return null;
  return (
    <span className="rc4-zoom" role="group" aria-label="Zoom the page">
      <button type="button" aria-label="Zoom out" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>
        −
      </button>
      <button type="button" aria-label="Zoom in" disabled={i === STEPS.length - 1} onClick={() => setI((x) => Math.min(STEPS.length - 1, x + 1))}>
        +
      </button>
    </span>
  );
}
