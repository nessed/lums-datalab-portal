"use client";
// The document viewer (data hub plan, section 7.1). pdf.js is loaded at run
// time from /pdfjs/ (copied there by scripts/prebuild/library.mjs) through an
// import the bundler leaves alone, so it is in no page's JavaScript bundle and
// is fetched only when a document page opens. The file is read by byte range
// (disableAutoFetch, rangeChunkSize), so a long report shows the page asked
// for before the whole file has arrived. The tagged-PDF structure tree is not
// read: on the long PBS reports it is most of the file (7.6 MB of the 15 MB
// Labour Force Survey 2020-21), against 3 MB to open it and draw a page; the
// text layer (search, selection, screen readers reading the words) stays.
//
// Opens at ?page=N or #page=N. Links marked data-viewer-page="N" anywhere on
// the page (the page thumbnails) jump the viewer instead of leaving the page.
// Without JavaScript, or if pdf.js cannot load, the reader gets a plain link
// to the PDF (rendered on the server, hidden once the viewer is ready).
//
// The server markup of this component holds no digits: page numbers, totals
// and zoom are drawn in the browser only.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const PDFJS = "/pdfjs/";

/* Just the parts of pdf.js used here (the installed pdfjs-dist 6.4 API). */
type PdfDoc = { numPages: number; destroy(): Promise<void>; getPage(n: number): Promise<{ getStructTree(): Promise<unknown> }> };
type LoadingTask = { promise: Promise<PdfDoc>; destroy(): Promise<void>; onProgress?: (p: { loaded: number; total: number }) => void };
type PdfLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: Record<string, unknown>): LoadingTask;
};
type EventBus = { on(name: string, fn: (e: Record<string, unknown>) => void): void; dispatch(name: string, e: Record<string, unknown>): void };
type Viewer = {
  setDocument(d: PdfDoc | null): void;
  currentPageNumber: number;
  currentScaleValue: string;
  currentScale: number;
  pagesCount: number;
  increaseScale(o?: { steps?: number }): void;
  decreaseScale(o?: { steps?: number }): void;
};
type ViewerLib = {
  EventBus: new () => EventBus;
  PDFLinkService: new (o: { eventBus: EventBus }) => { setViewer(v: Viewer): void; setDocument(d: PdfDoc | null, base?: string | null): void };
  PDFFindController: new (o: { eventBus: EventBus; linkService: unknown }) => unknown;
  PDFViewer: new (o: Record<string, unknown>) => Viewer;
};

let libs: Promise<{ lib: PdfLib; viewer: ViewerLib }> | null = null;
function loadPdfjs() {
  libs ??= (async () => {
    const main = `${PDFJS}pdf.min.mjs`;
    const lib = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ main)) as PdfLib;
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
    // pdf_viewer.mjs reads the library from globalThis.pdfjsLib, which pdf.min.mjs sets.
    const vmod = `${PDFJS}pdf_viewer.mjs`;
    const viewer = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ vmod)) as ViewerLib;
    return { lib, viewer };
  })().catch((e) => {
    libs = null;
    throw e;
  });
  return libs;
}

function addViewerCss() {
  if (document.querySelector("link[data-pdfjs-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `${PDFJS}pdf_viewer.css`;
  l.dataset.pdfjsCss = "";
  document.head.appendChild(l);
}

/** The page asked for in the address: #page=N (a link's own target), else ?page=N (kept current as the reader moves). */
function askedPage(): number | null {
  try {
    const u = new URL(window.location.href);
    const q = /(?:^#|&)page=(\d+)/.exec(u.hash)?.[1] ?? u.searchParams.get("page") ?? null;
    const n = q ? Number.parseInt(q, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

type Find = { state: "idle" | "pending" | "found" | "none" | "wrapped"; current: number; total: number };

export default function PdfViewer({ src, title, downloadName }: { src: string; title: string; downloadName: string }) {
  const section = useRef<HTMLElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const busRef = useRef<EventBus | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // True once running in the browser (false in the server HTML): the toolbar is shown only then.
  const js = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [page, setPage] = useState(1);
  const [pageText, setPageText] = useState("");
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [find, setFind] = useState<Find>({ state: "idle", current: 0, total: 0 });
  const [full, setFull] = useState(false);

  const goTo = useCallback((n: number) => {
    const v = viewerRef.current;
    if (!v || !v.pagesCount) return;
    v.currentPageNumber = Math.min(Math.max(1, Math.round(n)), v.pagesCount);
  }, []);

  useEffect(() => {
    let dead = false;
    let task: LoadingTask | null = null;
    let doc: PdfDoc | null = null;
    addViewerCss();
    (async () => {
      try {
        const { lib, viewer: V } = await loadPdfjs();
        if (dead || !container.current || !inner.current) return;
        const bus = new V.EventBus();
        const linkService = new V.PDFLinkService({ eventBus: bus });
        const findController = new V.PDFFindController({ eventBus: bus, linkService });
        const viewer = new V.PDFViewer({ container: container.current, viewer: inner.current, eventBus: bus, linkService, findController, textLayerMode: 1, annotationMode: 1, removePageBorders: false });
        linkService.setViewer(viewer);
        viewerRef.current = viewer;
        busRef.current = bus;
        const first = askedPage();
        bus.on("pagesinit", () => {
          viewer.currentScaleValue = "page-width";
          if (first) viewer.currentPageNumber = Math.min(first, viewer.pagesCount);
        });
        bus.on("pagechanging", (e) => {
          const n = Number(e.pageNumber);
          setPage(n);
          setPageText(String(n));
          try {
            const u = new URL(window.location.href);
            // ?page=N follows the reader; a #page=N that has been used is dropped so it cannot win over it later.
            const usedHash = /(?:^#|&)page=\d+/.test(u.hash);
            if (u.searchParams.get("page") !== String(n) || usedHash) {
              u.searchParams.set("page", String(n));
              if (usedHash) u.hash = "viewer";
              window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
            }
          } catch {
            /* the address is only a convenience */
          }
        });
        bus.on("scalechanging", (e) => setZoom(Math.round(Number(e.scale) * 100)));
        bus.on("updatefindcontrolstate", (e) => {
          const m = (e.matchesCount ?? { current: 0, total: 0 }) as { current: number; total: number };
          const st = ["found", "none", "wrapped", "pending"][Number(e.state)] as Find["state"];
          setFind({ state: st ?? "idle", current: m.current, total: m.total });
        });
        bus.on("updatefindmatchescount", (e) => {
          const m = (e.matchesCount ?? { current: 0, total: 0 }) as { current: number; total: number };
          setFind((f) => ({ ...f, current: m.current, total: m.total }));
        });
        task = lib.getDocument({
          url: src,
          // Byte ranges: only what the visible pages need is fetched.
          disableAutoFetch: true,
          disableStream: true,
          rangeChunkSize: 64 * 1024,
          cMapUrl: `${PDFJS}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${PDFJS}standard_fonts/`,
          wasmUrl: `${PDFJS}wasm/`,
          iccUrl: `${PDFJS}iccs/`,
          isEvalSupported: false,
          enableXfa: false,
        });
        task.onProgress = (p) => setLoaded(p.total ? p.loaded / p.total : null);
        doc = await task.promise;
        if (dead) return;
        // No structure tree (see the note at the top): each page reports none, as an untagged PDF does.
        const getPage = doc.getPage.bind(doc);
        doc.getPage = async (n: number) => {
          const p = await getPage(n);
          p.getStructTree = async () => null;
          return p;
        };
        viewer.setDocument(doc);
        linkService.setDocument(doc, null);
        setTotal(doc.numPages);
        setStatus("ready");
      } catch {
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
      viewerRef.current?.setDocument(null);
      viewerRef.current = null;
      busRef.current = null;
      task?.destroy().catch(() => {});
      doc = null;
    };
  }, [src]);

  // Thumbnails and in-page links: data-viewer-page="N" jumps the viewer; #page=N in the address too.
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.("a[data-viewer-page]");
      if (!a || !viewerRef.current) return;
      const n = Number(a.getAttribute("data-viewer-page"));
      if (!Number.isFinite(n)) return;
      ev.preventDefault();
      goTo(n);
      section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      container.current?.focus({ preventScroll: true });
    };
    const onHash = () => {
      const n = askedPage();
      if (n) goTo(n);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, [goTo]);

  /** Refit after the box changes size. */
  const refit = useCallback(() => {
    window.setTimeout(() => {
      if (viewerRef.current) viewerRef.current.currentScaleValue = "page-width";
    }, 120);
  }, []);

  useEffect(() => {
    const onFs = () => {
      setFull(document.fullscreenElement === section.current);
      refit();
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [refit]);

  // Where the browser refuses full screen (an embedded frame, some phones), the
  // viewer fills the window instead (CSS: .pv.is-full); Escape leaves it.
  useEffect(() => {
    if (!full || document.fullscreenElement) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFull(false);
        refit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [full, refit]);

  const toggleFull = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (full) {
      setFull(false);
      refit();
      return;
    }
    let done = false;
    const inWindow = () => {
      if (done || document.fullscreenElement) return;
      done = true;
      setFull(true);
      refit();
    };
    const el = section.current;
    if (el?.requestFullscreen && document.fullscreenEnabled) {
      el.requestFullscreen().catch(inWindow);
      // Some embedded browsers never settle the request: fill the window after a second.
      window.setTimeout(inWindow, 1000);
    } else inWindow();
  };

  const search = (again: boolean, previous = false) => {
    const q = query.trim();
    if (!q || !busRef.current) return;
    busRef.current.dispatch("find", { source: null, type: again ? "again" : "", query: q, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
  };

  const ready = status === "ready";
  const findWords =
    find.state === "idle" || !query.trim()
      ? ""
      : find.state === "pending"
        ? "Searching…"
        : find.state === "none"
          ? "Not found in this document"
          : `${find.current} of ${find.total}${find.state === "wrapped" ? ", from the start again" : ""}`;

  return (
    <section ref={section} id="viewer" className={`pv${js ? " is-js" : ""}${full ? " is-full" : ""}`} aria-label={`Document viewer: ${title}`} data-viewer-src={src}>
      <div className="pv-bar" role="toolbar" aria-label="Document viewer controls" hidden={!js}>
        <div className="pv-group">
          <button type="button" className="pv-btn" onClick={() => goTo(page - 1)} disabled={!ready || page <= 1} aria-label="Previous page">
            <span aria-hidden="true">‹</span>
          </button>
          <form
            className="pv-page"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number.parseInt(pageText, 10);
              if (Number.isFinite(n)) goTo(n);
              else setPageText(String(page));
            }}
          >
            <label htmlFor="pv-page-input" className="pv-label">
              Page
            </label>
            <input
              id="pv-page-input"
              className="pv-input tnum"
              inputMode="numeric"
              autoComplete="off"
              value={pageText}
              onChange={(e) => setPageText(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => setPageText(String(viewerRef.current?.currentPageNumber ?? page))}
              disabled={!ready}
              size={4}
              aria-describedby="pv-total"
            />
            <span id="pv-total" className="pv-of tnum">
              {total ? `of ${total}` : ""}
            </span>
          </form>
          <button type="button" className="pv-btn" onClick={() => goTo(page + 1)} disabled={!ready || page >= total} aria-label="Next page">
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="pv-group">
          <button type="button" className="pv-btn" onClick={() => viewerRef.current?.decreaseScale()} disabled={!ready} aria-label="Zoom out">
            <span aria-hidden="true">−</span>
          </button>
          <span className="pv-zoom tnum" aria-live="polite" aria-label="Zoom">
            {zoom ? `${zoom}%` : ""}
          </span>
          <button type="button" className="pv-btn" onClick={() => viewerRef.current?.increaseScale()} disabled={!ready} aria-label="Zoom in">
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            className="pv-btn pv-btn-text"
            onClick={() => {
              if (viewerRef.current) viewerRef.current.currentScaleValue = "page-width";
            }}
            disabled={!ready}
          >
            Fit width
          </button>
        </div>
        <form
          className="pv-group pv-find"
          role="search"
          aria-label="Search in this document"
          onSubmit={(e) => {
            e.preventDefault();
            search(find.state !== "idle" && find.state !== "none");
          }}
        >
          <input
            type="search"
            className="pv-input pv-q"
            placeholder="Search in the document"
            aria-label="Search in the document"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFind({ state: "idle", current: 0, total: 0 });
            }}
            disabled={!ready}
          />
          <button type="button" className="pv-btn" onClick={() => search(true, true)} disabled={!ready || !query.trim()} aria-label="Previous match">
            <span aria-hidden="true">↑</span>
          </button>
          <button type="submit" className="pv-btn" disabled={!ready || !query.trim()} aria-label="Next match">
            <span aria-hidden="true">↓</span>
          </button>
          <span className="pv-found small" role="status">
            {findWords}
          </span>
        </form>
        <div className="pv-group pv-end">
          <a className="pv-btn pv-btn-text" href={src} download={downloadName}>
            Download
          </a>
          <button
            type="button"
            className="pv-btn pv-btn-text"
            onClick={toggleFull}
          >
            {full ? "Leave full screen" : "Full screen"}
          </button>
        </div>
      </div>
      <div className="pv-stage">
        <div ref={container} className="pv-container" tabIndex={0} role="region" aria-label={`Pages of ${title}`}>
          <div ref={inner} className="pdfViewer" />
        </div>
        {status !== "ready" ? (
          <div className="pv-fallback">
            {js && status === "loading" ? (
              <p role="status">
                Opening the document{loaded !== null && loaded > 0 ? ` (${Math.round(loaded * 100)}% of the file so far)` : ""}…
              </p>
            ) : null}
            {status === "error" ? <p role="alert">The viewer could not open this file in your browser.</p> : null}
            <p>
              <a className="btn btn-primary" href={src}>
                Open the PDF
              </a>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
