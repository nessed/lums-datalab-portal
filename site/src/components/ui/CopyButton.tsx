"use client";
// Copies a string to the clipboard. Without JavaScript the button is inert and
// the text it copies is always visible next to it on the page.
import { useState } from "react";
import { IconCopy } from "./Icons";

/** `origin`: prefix the text with the current site address (for permalinks). */
export default function CopyButton({ text, label, className = "btn", origin }: { text: string; label: string; className?: string; origin?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      data-copied={done ? "true" : undefined}
      onClick={async () => {
        const value = origin ? `${window.location.origin}${text}` : text;
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        window.setTimeout(() => setDone(false), 1800);
      }}
    >
      <IconCopy />
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
