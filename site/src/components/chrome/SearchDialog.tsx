"use client";
// Site search. A visible field in the header opens a dialog; Ctrl/Cmd-K and "/"
// open it from anywhere. The index is fetched once, on first open. Results are
// links, so Enter, middle-click and "open in new tab" all work. Without
// JavaScript the trigger is a plain link to /browse.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { search, type SearchEntry } from "@/lib/search";
import { IconSearch } from "@/components/ui/Icons";

function Highlight({ text, q }: { text: string; q: string }) {
  const ts = q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (ts.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${ts.join("|")})`, "ig"));
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}</>;
}

export default function SearchDialog({ indexUrl }: { indexUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const [mac, setMac] = useState(false);

  const open = useCallback(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    window.setTimeout(() => input.current?.select(), 0);
    if (!index && !failed) {
      fetch(indexUrl)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: SearchEntry[]) => setIndex(j))
        .catch(() => setFailed(true));
    }
  }, [index, failed, indexUrl]);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        open();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = index ? search(index, q, 30) : [];
  const browseHref = `/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`;

  const go = (href: string) => {
    dialog.current?.close();
    window.location.assign(href);
  };

  return (
    <>
      <a
        href="/browse"
        className="search-trigger"
        onClick={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <IconSearch />
        <span className="search-word">Search series and documents</span>
        <span className="sr-only">Search</span>
        <span className="search-hint" aria-hidden="true">
          <kbd>{mac ? "⌘" : "Ctrl"}</kbd> <kbd>K</kbd>
        </span>
      </a>
      <dialog
        ref={dialog}
        className="search-dialog"
        aria-label="Search series and documents"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="search-box">
          <IconSearch />
          <input
            ref={input}
            type="search"
            value={q}
            placeholder="Health spending, CPI food, Budget Statement 2025-26…"
            aria-label="Search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const r = results[active];
                go(r ? r.h : browseHref);
              }
            }}
          />
          <button type="button" className="btn btn-text" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        {failed ? (
          <p className="small" style={{ padding: "12px 16px" }}>
            The search index could not be loaded. <a href={browseHref}>Browse the catalogue instead</a>.
          </p>
        ) : !index ? (
          <p className="small muted" style={{ padding: "12px 16px" }}>
            Loading the index…
          </p>
        ) : q.trim() === "" ? (
          <p className="small muted" style={{ padding: "12px 16px" }}>
            Type a series name, a topic, a dataset or a document title. Every series in a published dataset and every source document is
            searchable.
          </p>
        ) : results.length === 0 ? (
          <p className="small" style={{ padding: "12px 16px" }}>
            Nothing matches &ldquo;{q}&rdquo;. Try fewer words, or <a href="/browse">browse the catalogue</a>.
          </p>
        ) : (
          <ul className="search-results" id={listId} role="listbox" aria-label="Results">
            {results.map((r, i) => (
              <li key={`${r.k}-${r.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)}>
                <a href={r.h} tabIndex={-1}>
                  <span className="r-title">
                    <Highlight text={r.n} q={q} />
                  </span>
                  <span className="r-meta">
                    {r.k === "d"
                      ? `Document · ${r.d} · ${r.p}`
                      : `${r.d} · ${r.u}${r.c ? ` · ${r.c} checked ${r.c === 1 ? "value" : "values"}, ${r.p}` : " · no checked values yet"}${r.x ? " · computed" : ""}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="search-foot">
          <span aria-hidden="true">
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span aria-hidden="true">
            <kbd>Enter</kbd> open
          </span>
          <span aria-hidden="true">
            <kbd>Esc</kbd> close
          </span>
          <a href={browseHref} style={{ marginLeft: "auto" }}>
            All results in the catalogue
          </a>
        </div>
      </dialog>
    </>
  );
}
