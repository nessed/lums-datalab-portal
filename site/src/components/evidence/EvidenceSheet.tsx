"use client";
// The one-tap evidence sheet (DESIGN.md section 7, "One tap"): a bottom sheet on
// phones, a popover on desktop, opened from any value link marked data-sheet.
// Contract:
//   - mounted once in the layout;
//   - intercepts clicks on a[data-sheet] (the attribute holds the figure's slug);
//   - the open sheet is in the URL as ?fig=<slug>; Back closes it;
//   - focus is trapped inside, Escape closes, focus returns to the link.
// The data is a small JSON per figure written at build time by
// scripts/prebuild/evidence.mjs (checked by scripts/checks/evidence-sheet.mjs)
// and fetched on open; nothing is fetched before a tap. Without JavaScript, or
// if the file cannot be fetched, the link simply opens the full receipt.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import config from "../../../release.config.json";
import { formatDecimalString } from "@/lib/format";
import type { SheetData } from "./model";

const BASE = `/data/${config.version}/evidence/sheet/`;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type State = { slug: string; data: SheetData | null; label: string };

function figParam(): string | null {
  try {
    return new URL(window.location.href).searchParams.get("fig");
  } catch {
    return null;
  }
}

function SheetCrop({ d }: { d: SheetData }) {
  const crop = d.crop!;
  const segs = [...new Set(crop.windows.map((w) => w.seg))].sort();
  const wid = (s: number) => crop.windows.find((w) => w.seg === s)?.px[2] ?? 1;
  const total = segs.reduce((a, s) => a + wid(s), 0);
  return (
    <figure className="ev-crop-fig">
      <p className="ev-proof-label">{d.proofWords}</p>
      <div className="ev-crop" data-split={segs.length > 1 ? "true" : undefined}>
        {segs.map((seg, k) => [
          k > 0 ? (
            <span key={`b${seg}`} className="ev-crop-break" aria-hidden="true">
              <span />
            </span>
          ) : null,
          <div key={seg} className="ev-crop-col" style={{ flex: `${(wid(seg) / total).toFixed(4)} 1 0` }}>
            {crop.windows
              .filter((w) => w.seg === seg)
              .map((w, j) => (
                <div key={w.file} className={`ev-crop-win ev-crop-win--${w.part}`}>
                  {j > 0 ? <span className="ev-crop-gap" aria-hidden="true" /> : null}
                  <div className="ev-crop-img" style={{ aspectRatio: `${w.px[2]} / ${w.px[3]}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${crop.base}${w.file}`}
                      width={w.px[2]}
                      height={w.px[3]}
                      alt={w.part === "rows" && k === 0 ? `Close-up of the printed page: the row "${d.row ?? ""}", the figure boxed.` : ""}
                    />
                    {w.bands.map((b, i) => (
                      <span key={i} className="ev-band" style={b} />
                    ))}
                    {w.box ? <span className="ev-box" style={w.box} /> : null}
                  </div>
                </div>
              ))}
          </div>,
        ])}
      </div>
      {crop.segments > 1 ? (
        <figcaption className="ev-crop-note">
          {crop.hidden > 0
            ? `Row labels on the left; ${crop.hidden} ${crop.hidden === 1 ? "column" : "columns"} between them and the figure ${crop.hidden === 1 ? "is" : "are"} not shown.`
            : "Row labels on the left; the space between them and the figure is not shown."}
        </figcaption>
      ) : null}
    </figure>
  );
}

function SheetVersions({ d }: { d: SheetData }) {
  const { items, steps, missing } = d.versions;
  return (
    <div className="ev-versions is-compact">
      <h3 className="ev-versions-h">Versions of this figure</h3>
      <ol className="ev-vs">
        {items.map((it, i) => {
          const step = i > 0 ? steps[i - 1] : null;
          const prev = i > 0 ? items[i - 1] : null;
          return [
            step ? (
              <li key={`s${i}`} className="ev-vs-step">
                <span aria-hidden="true">↓ </span>
                {step.pct ? (
                  <>
                    <span className="ev-vs-pct">{step.pct}</span> on the {prev!.kindWord.toLowerCase()}
                    {step.dir === "up" ? ", revised up" : step.dir === "down" ? ", revised down" : ""}
                  </>
                ) : (
                  <span className="muted">No change shown: {step.reason}.</span>
                )}
              </li>
            ) : null,
            <li key={it.obsId} className={`ev-vs-item${it.isThis ? " is-this" : ""}`}>
              <span className="ev-vs-kind">
                {it.kindWord}
                {it.kindWord !== "As printed" ? ` ${it.periodWords}` : ""}
                {it.printedIn.length ? <span className="ev-vs-where"> (printed in {it.printedIn.map((p) => p.title).join(", and again in ")})</span> : null}:
              </span>{" "}
              <a href={`/o/${it.slug}`} className="ev-vs-val">
                {it.value !== null ? `${formatDecimalString(it.value)} ${it.unit}` : it.word}
              </a>
              {it.isThis ? <span className="ev-vs-this"> (this figure)</span> : null}
            </li>,
          ];
        })}
        {missing.map((m) => (
          <li key={m} className="ev-vs-item ev-vs-missing">
            {m}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function EvidenceSheet() {
  const [st, setSt] = useState<State | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLAnchorElement | null>(null);
  const pushed = useRef(false);
  const panel = useRef<HTMLDivElement | null>(null);
  const cache = useRef(new Map<string, SheetData>());

  const load = useCallback((slug: string, label: string, fallbackHref: string | null) => {
    const hit = cache.current.get(slug);
    setSt({ slug, data: hit ?? null, label });
    if (hit) return;
    fetch(`${BASE}${encodeURIComponent(slug)}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SheetData>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        cache.current.set(slug, data);
        setSt((cur) => (cur && cur.slug === slug ? { ...cur, data } : cur));
      })
      .catch(() => {
        // The receipt always works: go there instead.
        if (fallbackHref) window.location.assign(fallbackHref);
        else setSt(null);
      });
  }, []);

  const shut = useCallback(() => {
    setSt(null);
    setPos(null);
    document.documentElement.classList.remove("ev-sheet-open");
    const a = anchor.current;
    anchor.current = null;
    if (a && document.contains(a)) a.focus();
  }, []);

  /** Close: through Back when the sheet added a history entry, so Back and Close agree. */
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // popstate then shuts the sheet
      return;
    }
    if (figParam()) {
      const u = new URL(window.location.href);
      u.searchParams.delete("fig");
      window.history.replaceState(window.history.state, "", u.toString());
    }
    shut();
  }, [shut]);

  useEffect(() => {
    // Open from a tap on any value link marked data-sheet. Capture phase, so
    // the client-side router never sees the click.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[data-sheet]") as HTMLAnchorElement | null;
      const slug = a?.getAttribute("data-sheet");
      if (!a || !slug) return;
      e.preventDefault();
      e.stopPropagation();
      anchor.current = a;
      const u = new URL(window.location.href);
      u.searchParams.set("fig", slug);
      if (figParam()) window.history.replaceState(window.history.state, "", u.toString());
      else {
        window.history.pushState(window.history.state, "", u.toString());
        pushed.current = true;
      }
      load(slug, a.getAttribute("aria-label") || a.textContent || "", a.href);
    };
    const onPop = () => {
      const f = figParam();
      if (!f) {
        pushed.current = false;
        shut();
      } else load(f, "", `/o/${f}`);
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    // A link to any page with ?fig=<slug> opens that figure's sheet.
    const f = figParam();
    if (f && /^[A-Za-z0-9._~-]+$/.test(f)) load(f, "", null);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [load, shut]);

  // Popover position on wide screens: under the link, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!st || !panel.current) return;
    const wide = window.matchMedia("(min-width: 720px)").matches;
    document.documentElement.classList.toggle("ev-sheet-open", !wide);
    if (!wide) {
      setPos(null);
      return;
    }
    const p = panel.current.getBoundingClientRect();
    if (!anchor.current) {
      // Opened from a link with ?fig=: centred near the top of the screen.
      const top = window.scrollY + 72;
      const left = Math.max(16, (window.innerWidth - p.width) / 2) + window.scrollX;
      setPos((cur) => (cur && Math.abs(cur.top - top) < 1 && Math.abs(cur.left - left) < 1 ? cur : { top, left }));
      return;
    }
    const r = anchor.current.getBoundingClientRect();
    const left = Math.min(Math.max(16, r.left), window.innerWidth - p.width - 16) + window.scrollX;
    const below = r.bottom + 8;
    const fitsBelow = below + p.height <= window.innerHeight - 8;
    const fitsAbove = r.top - 8 - p.height >= 8;
    // Neither fits: as low as the screen allows, so the whole popover is visible.
    const top = (fitsBelow ? below : fitsAbove ? r.top - 8 - p.height : Math.max(8, window.innerHeight - p.height - 8)) + window.scrollY;
    setPos((cur) => (cur && Math.abs(cur.top - top) < 1 && Math.abs(cur.left - left) < 1 ? cur : { top, left }));
  }, [st]);

  // Focus moves into the sheet when it opens.
  const openSlug = st?.slug ?? null;
  // On a wide screen the popover is hidden until placed, so this runs again once it is.
  useEffect(() => {
    if (!openSlug || !panel.current || panel.current.contains(document.activeElement)) return;
    panel.current.querySelector<HTMLElement>(".ev-sheet-close")?.focus({ preventScroll: true });
  }, [openSlug, pos]);

  if (!st) return null;
  const d = st.data;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = panel.current.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className="ev-sheet-backdrop" onClick={close} aria-hidden="true" />
      <div
        ref={panel}
        className={`ev-sheet${pos ? " is-popover" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-sheet-h"
        onKeyDown={onKeyDown}
        style={pos ? { top: pos.top, left: pos.left } : undefined}
      >
        <div className="ev-sheet-bar">
          <h2 id="ev-sheet-h" className="ev-sheet-h">
            {d ? d.title : "Where this figure is printed"}
          </h2>
          <button type="button" className="btn ev-sheet-close" onClick={close}>
            Close
          </button>
        </div>
        {!d ? (
          <p className="ev-sheet-loading" role="status">
            Loading where it is printed{st.label ? `: ${st.label}` : ""}…
          </p>
        ) : (
          <div className="ev-sheet-body">
            <p className="ev-sheet-fig">
              <span className="ev-sheet-kind">{d.kind === "As printed" ? d.period : `${d.kind}, ${d.period}`}</span>
              {d.value ? (
                <span className="ev-sheet-v tnum">
                  {d.value} <span className="ev-sheet-u">{d.unit}</span>
                </span>
              ) : null}
            </p>
            {d.crop ? <SheetCrop d={d} /> : d.proofWords ? <p className="ev-proof-words">{d.proofWords}</p> : null}
            {d.doc ? (
              <dl className="ev-sheet-facts">
                <dt>Document</dt>
                <dd>
                  <a href={d.doc.href}>{d.doc.title}</a>
                </dd>
                {d.page ? (
                  <>
                    <dt>Page</dt>
                    <dd>{d.page.printed ? `printed page ${d.page.printed} (page ${d.page.pdf} of the PDF file)` : `page ${d.page.pdf} of the PDF file`}</dd>
                  </>
                ) : null}
                {d.row ? (
                  <>
                    <dt>Row as printed</dt>
                    <dd>{d.row}</dd>
                  </>
                ) : null}
                {d.col ? (
                  <>
                    <dt>Column as printed</dt>
                    <dd>{d.col}</dd>
                  </>
                ) : null}
                {d.printed ? (
                  <>
                    <dt>Printed as</dt>
                    <dd className="mono">{d.printed}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            <p className="ev-sheet-verdict">{d.verdict}</p>
            <SheetVersions d={d} />
            <div className="ev-sheet-actions">
              <a className="btn btn-primary" href={d.href}>
                Full receipt
              </a>
              <a className="btn" href={d.cite}>
                Cite
              </a>
              {d.doc?.pdf && d.page ? (
                <a className="btn" href={d.doc.pdf} rel="noopener" aria-label={`Official PDF at page ${d.page.pdf}`}>
                  Official PDF, p. {d.page.pdf}
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
