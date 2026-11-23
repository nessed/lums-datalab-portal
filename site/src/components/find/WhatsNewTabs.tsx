"use client";
// Tabs over the "What's new" list on /releases (design set 2026-11-23). The
// server renders every entry and the corrections block; this only toggles
// `hidden` on what the server rendered (AGENTS.md section 7: never compute or
// fetch a figure on the client). The tab is read from the URL as an external
// store: ?type=added | editions, or the hash #corrections (the header's About
// menu and the footer link there). Without JavaScript the tabs are anchors and
// the whole list shows, followed by the corrections block (#corrections).
import { useEffect, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

export type WnTab = "all" | "added" | "editions" | "corrections";
const TABS: WnTab[] = ["all", "added", "editions", "corrections"];
const EVENT = "wn-tab-change";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener("hashchange", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("hashchange", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function tabOf(search: string, hash: string): WnTab {
  if (hash === "#corrections") return "corrections";
  const t = new URLSearchParams(search).get("type");
  return t && (TABS as string[]).includes(t) ? (t as WnTab) : "all";
}

const hrefOf = (t: WnTab) => (t === "corrections" ? "/releases#corrections" : t === "all" ? "/releases#whats-new" : `/releases?type=${t}#whats-new`);

export default function WhatsNewTabs({ tabs }: { tabs: { key: WnTab; label: string; n: ReactNode }[] }) {
  const tab = useSyncExternalStore(
    subscribe,
    () => tabOf(window.location.search, window.location.hash),
    () => "all" as WnTab,
  );

  useEffect(() => {
    const list = document.getElementById("wn-list");
    if (list) list.hidden = tab === "corrections";
    for (const el of document.querySelectorAll<HTMLElement>("#wn-list [data-wn-kind]")) el.hidden = !(tab === "all" || el.dataset.wnKind === tab);
    const corr = document.getElementById("corrections");
    // The corrections block shows on its own tab, and on "All" only when it lists a correction.
    if (corr) corr.hidden = !(tab === "corrections" || (tab === "all" && corr.dataset.wnHas === "1"));
  }, [tab]);

  const pick = (t: WnTab) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const q = new URLSearchParams(window.location.search);
    if (t === "all" || t === "corrections") q.delete("type");
    else q.set("type", t);
    const qs = q.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${t === "corrections" ? "#corrections" : ""}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <nav className="wn-tabs" aria-label="Show">
      {tabs.map((t) => (
        <a key={t.key} href={hrefOf(t.key)} className="wn-tab" aria-current={tab === t.key ? "true" : undefined} onClick={pick(t.key)}>
          {t.label} <span className="wn-tab-n">{t.n}</span>
        </a>
      ))}
    </nav>
  );
}
