"use client";
// The URL is the state for chart toggles, ranges and table order. This hook
// reads the query string as an external store: the server renders the default
// (empty query), the browser re-renders from the real URL, and the back button
// works. Writes go through setQuery, which pushes or replaces a history entry.
import { useSyncExternalStore } from "react";

const EVENT = "urlstatechange";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useQuery(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search);
}

/** Set (or with null, remove) query parameters and notify every useQuery. */
export function setQuery(patch: Record<string, string | null>, mode: "push" | "replace" = "push") {
  const q = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") q.delete(k);
    else q.set(k, v);
  }
  const qs = q.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}

/** True on Apple platforms (for the Cmd/Ctrl key hint); false during server render. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}
