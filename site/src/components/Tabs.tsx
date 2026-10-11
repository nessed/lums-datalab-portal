"use client";
// Tabs over server-rendered panels. Without JavaScript every panel is shown,
// in order, with its heading. With it, one panel at a time; the choice is in
// the URL (?tab=table) so a link opens the same tab. Arrow keys move between
// tabs (WAI-ARIA tabs pattern, manual activation is not needed here).
import { Children, isValidElement, useRef, useSyncExternalStore, type ReactNode } from "react";
import { setQuery, useQuery } from "@/lib/url-state";

export type TabDef = { id: string; label: string };

export default function Tabs({ tabs, children, param = "tab", label }: { tabs: TabDef[]; children: ReactNode; param?: string; label: string }) {
  const q = useQuery();
  const asked = q.get(param);
  const active = tabs.some((t) => t.id === asked) ? asked! : tabs[0].id;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = Children.toArray(children).filter(isValidElement);
  // False during the server render and the first paint: every panel is in the
  // HTML, and CSS shows only the first until the tabs are live.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const pick = (id: string, focus = false) => {
    setQuery({ [param]: id === tabs[0].id ? null : id }, "replace");
    if (focus) refs.current[tabs.findIndex((t) => t.id === id)]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length;
    if (e.key === "ArrowRight") pick(tabs[(i + 1) % n].id, true);
    else if (e.key === "ArrowLeft") pick(tabs[(i - 1 + n) % n].id, true);
    else if (e.key === "Home") pick(tabs[0].id, true);
    else if (e.key === "End") pick(tabs[n - 1].id, true);
    else return;
    e.preventDefault();
  };

  return (
    <div className="tabset" data-active={active} data-ready={ready ? "true" : undefined}>
      <div className="tablist" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => pick(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {panels.map((p, i) => (
        <div key={tabs[i]?.id ?? i} role="tabpanel" id={`panel-${tabs[i]?.id}`} aria-labelledby={`tab-${tabs[i]?.id}`} className="tabpanel" data-panel={tabs[i]?.id} hidden={ready && active !== tabs[i]?.id} tabIndex={0}>
          {p}
        </div>
      ))}
    </div>
  );
}
