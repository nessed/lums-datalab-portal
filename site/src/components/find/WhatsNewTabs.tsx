"use client";
// Tabs of /releases (Home v3 pages set, 2026-11-24): Upcoming, Added recently,
// Corrections. The server renders all three panels and every entry; this only
// toggles `hidden` on what the server rendered (AGENTS.md section 7: never
// compute or fetch a figure on the client), and filters the "Added recently"
// rows by words and kind. The tab is read from the URL as an external store:
// ?tab=added, or the hash #corrections (the header's About menu and the footer
// link there) or #upcoming. The old ?type=added|editions addresses open
// "Added recently" with that kind chosen. Without JavaScript every panel shows,
// one after another.
import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";

export type RlTab = "upcoming" | "added" | "corrections";
const EVENT = "rl-tab-change";

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

function tabOf(search: string, hash: string): RlTab {
  if (hash === "#corrections") return "corrections";
  if (hash === "#upcoming") return "upcoming";
  const q = new URLSearchParams(search);
  const t = q.get("tab");
  if (t === "added" || t === "corrections" || t === "upcoming") return t;
  if (q.get("type")) return "added";
  return "upcoming";
}

const hrefOf = (t: RlTab) => (t === "corrections" ? "/releases#corrections" : t === "upcoming" ? "/releases#upcoming" : "/releases?tab=added#added");

export default function WhatsNewTabs({ tabs }: { tabs: { key: RlTab; label: string }[] }) {
  const tab = useSyncExternalStore(
    subscribe,
    () => tabOf(window.location.search, window.location.hash),
    () => "upcoming" as RlTab,
  );
  const typeParam = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get("type") ?? "",
    () => "",
  );
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const k = kind || (typeParam === "added" || typeParam === "editions" ? typeParam : "");

  useEffect(() => {
    for (const t of tabs) {
      const el = document.getElementById(`rl-panel-${t.key}`);
      if (el) el.hidden = t.key !== tab;
    }
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (const el of document.querySelectorAll<HTMLElement>("#wn-list [data-wn-kind]")) {
      const text = (el.textContent ?? "").toLowerCase();
      el.hidden = !((!k || el.dataset.wnKind === k) && words.every((w) => text.includes(w)));
    }
  }, [tab, tabs, q, k]);

  const pick = (t: RlTab) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const u = new URLSearchParams(window.location.search);
    u.delete("type");
    if (t === "added") u.set("tab", "added");
    else u.delete("tab");
    const qs = u.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${t === "corrections" ? "#corrections" : ""}`);
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <>
      <div className="rl-tabs" role="tablist" aria-label="Releases">
        {tabs.map((t) => (
          <a key={t.key} role="tab" href={hrefOf(t.key)} className="rl-tab" aria-selected={tab === t.key} aria-controls={`rl-panel-${t.key}`} onClick={pick(t.key)}>
            {t.label}
          </a>
        ))}
      </div>
      {tab === "added" ? (
        <form className="rl-filter" role="search" aria-label="Filter what was added" onSubmit={(e) => e.preventDefault()}>
          <input type="search" placeholder="Filter by name" aria-label="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Kind" value={k} onChange={(e) => setKind(e.target.value)}>
            <option value="">Everything added</option>
            <option value="added">Data types</option>
            <option value="editions">Document editions</option>
            <option value="held">Figures held back</option>
          </select>
        </form>
      ) : null}
    </>
  );
}
