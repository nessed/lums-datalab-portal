"use client";
// The header search (DESIGN.md 9.1, 10). A real field in the header of every
// page: without JavaScript it is a form that opens /search?q=. With
// JavaScript, tapping it, typing in it, "/" or Ctrl/Cmd-K opens the search
// dialog (full screen on phones) with the same words, and the index is fetched
// on first focus. The dialog is modal (the page behind it is inert, so focus
// stays inside) and Escape closes it. Its input is a combobox over a listbox of
// results; the answer card above the list holds ordinary links.
// The results code is a separate chunk, loaded on first open.
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { useIsMac } from "@/lib/url-state";
import { IconSearch } from "@/components/ui/Icons";

const DialogResults = lazy(() => import("@/components/search/DialogResults"));

const hrefFor = (q: string, infer: boolean) => `/search?q=${encodeURIComponent(q.trim())}${infer ? "" : "&infer=0"}`;

/** variant "big" (Home v2): the large field in the search row under the header,
 * with a Search button; typing still opens the same dialog of instant answers. */
export default function SearchDialog({ indexUrl, variant }: { indexUrl: string; variant?: "big" | "head" }) {
  const big = variant === "big";
  const head = variant === "head";
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [infer, setInfer] = useState(true);
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState(0);
  const [opts, setOpts] = useState<string[]>([]);
  const listId = useId();
  const mac = useIsMac();

  const warm = useCallback(() => {
    import("@/lib/search").then((m) => m.loadEngine(indexUrl)).catch(() => {});
  }, [indexUrl]);

  const open = useCallback((text: string) => {
    const d = dialog.current;
    const el = input.current;
    if (!d || !el) return;
    setQ(text);
    setInfer(true);
    setActive(0);
    setOpened(true);
    if (!d.open) d.showModal();
    // Focus inside the same user gesture, so a phone keeps its keyboard up.
    el.value = text;
    el.focus();
    el.setSelectionRange(text.length, text.length);
  }, []);

  const close = () => dialog.current?.close();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        open(field.current?.value ?? "");
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        open(field.current?.value ?? "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onQuery = useCallback((next: string, nextInfer = true) => {
    setQ(next);
    setInfer(nextInfer);
    setActive(0);
    const el = input.current;
    if (el) {
      el.value = next;
      el.focus();
    }
  }, []);
  const onOptions = useCallback((hrefs: string[]) => {
    setOpts(hrefs);
    setActive((a) => (a >= hrefs.length ? 0 : a));
  }, []);

  const go = (href: string) => {
    close();
    window.location.assign(href);
  };
  const expanded = opts.length > 0;

  return (
    <>
      <form action="/search" method="get" role="search" className={big ? "hs hs-big" : head ? "hs hs-head" : "hs"} aria-label="Search the site">
        <label htmlFor="hs-q" className="sr-only">
          Search series, documents and tables
        </label>
        <IconSearch />
        <input
          ref={field}
          id="hs-q"
          name="q"
          type="search"
          className="hs-input"
          placeholder={big ? "Search prices, budgets, jobs, documents" : head ? "Search the data" : "Search"}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onFocus={warm}
          onClick={(e) => open(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              open(e.currentTarget.value + e.key);
            }
          }}
          onInput={(e) => open(e.currentTarget.value)}
        />
        <span className="hs-hint" aria-hidden="true">
          <kbd>{mac ? "⌘" : "Ctrl"}</kbd> <kbd>K</kbd>
        </span>
        {big || head ? (
          <button type="submit" className="hs-go">
            Search
          </button>
        ) : null}
      </form>
      <dialog
        ref={dialog}
        className="search-dialog"
        aria-label="Search"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        onClose={() => {
          if (field.current) field.current.value = q;
          setOpts([]);
        }}
      >
        <div className="search-box">
          <IconSearch />
          <label htmlFor="hs-dq" className="sr-only">
            Search series, documents and tables
          </label>
          <input
            ref={input}
            id="hs-dq"
            type="search"
            defaultValue=""
            placeholder="Inflation, health spending, CPI food…"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={expanded && opts[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(e) => {
              setQ(e.target.value);
              setInfer(true);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(0, opts.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (!q.trim()) return;
                go(opts[active] ?? hrefFor(q, infer));
              } else if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          />
          <button type="button" className="btn search-close" onClick={close}>
            Close
          </button>
        </div>
        <div className="search-body">
          {opened ? (
            <Suspense fallback={<p className="search-msg muted">Loading…</p>}>
              <DialogResults
                indexUrl={indexUrl}
                q={q}
                infer={infer}
                listId={listId}
                active={active}
                setActive={setActive}
                onOptions={onOptions}
                onQuery={onQuery}
              />
            </Suspense>
          ) : null}
        </div>
        <div className="search-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </dialog>
    </>
  );
}
