// The action row of a series or a receipt (DESIGN.md 9.5 item 4, 7.1 item 3):
// Download · Cite · Compare · Share. Each button is a plain link to a sheet on
// the same page (#sheet-...), shown by CSS while it is the :target, so all of
// it works without JavaScript; SheetEnhance adds focus handling and Escape.
//   Download: what each file is for and its size, before the click (13.1).
//   Cite:     the default sentence, then APA, Chicago, Harvard, BibTeX and RIS,
//             with the release-pinned link and the access date (13.2).
//   Share:    "this release" (pinned) and "always the latest" (13.3).
// Place each button once per page: the sheet ids come from the series or path.
import Link from "@/components/ui/Link";
import { Num } from "@/components/ui/Num";
import { db, RELEASE_VERSION } from "@/lib/data";
import { VERSION_FILES } from "@/lib/take-columns";
import { absoluteUrl, citationFor, fileHref, latestFileHref, pinnedPath, seriesFiles, sizeText } from "@/lib/take";
import { Sheet, sheetId } from "./Sheet";
import { OriginText } from "./OriginText";
import { CiteFormats, PrototypeNote, ShareLinks } from "./CiteBody";

const MAIN_WORDS = {
  xlsx: { label: "Excel (.xlsx)", what: "For Excel: a Data sheet with one row per figure, a README sheet, a Sources sheet and the citation." },
  csv: {
    label: "CSV, long",
    what: "One row per figure: series, period, kind of figure, document and page, value as printed, value, unit, status and its reason in their own columns. For R, Stata or Python.",
  },
  zip: { label: "Data package (.zip)", what: "The CSV with datapackage.json, a README, the licence and CITATION.cff." },
} as const;

/** Download for one series (all years). Primary button on a series page. */
export function DownloadButton({ seriesId, primary = true }: { seriesId: string; primary?: boolean }) {
  const s = db().seriesById.get(seriesId);
  const f = seriesFiles(seriesId);
  const id = sheetId("dl", seriesId);
  const csvLatest = latestFileHref(`series/${f.slug}.csv`);
  return (
    <>
      <a className={`btn${primary ? " btn-primary" : ""}`} href={`#${id}`} aria-haspopup="dialog">
        Download
      </a>
      <Sheet id={id} title="Download this series">
        <p className="sheet-lede">
          <strong>{s?.name ?? seriesId}</strong>: every period and kind of figure, one row each. Figures without a value are rows with their status, never zeros.
        </p>
        <ul className="dl-list">
          {f.main.map((m) => (
            <li key={m.key}>
              <a href={fileHref(m.rel)} download className="dl-file">
                <span className="dl-name">{MAIN_WORDS[m.key].label}</span>
                <span className="dl-size">
                  <Num kind="ui">{sizeText(m.size)}</Num>
                </span>
              </a>
              <span className="dl-what">{MAIN_WORDS[m.key].what}</span>
            </li>
          ))}
        </ul>
        {f.versions.length ? (
          <>
            <h3 className="dl-h3">Every printing of each figure</h3>
            <p className="small muted">These figures are printed in more than one edition. Choose which printing you want.</p>
            <ul className="dl-list dl-list--compact">
              {VERSION_FILES.map((v) => {
                const file = f.versions.find((x) => x.key === v.key);
                if (!file) return null;
                return (
                  <li key={v.key}>
                    <a href={fileHref(file.rel)} download className="dl-file">
                      <span className="dl-name">{v.label}, CSV</span>
                      <span className="dl-size">
                        <Num kind="ui">{sizeText(file.size)}</Num>
                      </span>
                    </a>
                    <span className="dl-what">{v.what}</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        <p className="small dl-foot">
          Every file names its release (<Num kind="version">{RELEASE_VERSION}</Num>), the date it was made, the licence and how to cite it, and links to the releases page,
          which says whether it is still current.
        </p>
        <details className="dl-more">
          <summary>A stable address for scripts and spreadsheets</summary>
          <p className="small">Always the latest release:</p>
          <code className="share-url">
            <Num kind="id">
              <OriginText text={absoluteUrl(csvLatest)} />
            </Num>
          </code>
          <p className="small">In Google Sheets, paste into a cell:</p>
          <pre className="code" data-num="id">
            <OriginText text={`=IMPORTDATA("${absoluteUrl(csvLatest)}")`} />
          </pre>
          <p className="small">This release only:</p>
          <code className="share-url">
            <Num kind="id">
              <OriginText text={absoluteUrl(fileHref(`series/${f.slug}.csv`))} />
            </Num>
          </code>
        </details>
      </Sheet>
    </>
  );
}

/** Cite a series, a figure or a view. `path` is the page being cited; the citation uses its release-pinned link. */
export function CiteButton({ path, primary = false }: { path: string; primary?: boolean }) {
  const c = citationFor(path);
  const id = sheetId("cite", path);
  const noun = c.kind === "figure" ? "this figure" : c.kind === "series" ? "this series" : c.kind === "document" ? "this document" : "this view";
  return (
    <>
      <a className={`btn${primary ? " btn-primary" : ""}`} href={`#${id}`} aria-haspopup="dialog">
        Cite
      </a>
      <Sheet id={id} title={`Cite ${noun}`} note={<PrototypeNote release={RELEASE_VERSION} isPrototype={db().info.isPrototype} doi={db().release.doi ?? null} />}>
        <CiteFormats cited={c} />
      </Sheet>
    </>
  );
}

/** Open the chart builder with this series. */
export function CompareButton({ seriesId }: { seriesId: string }) {
  return (
    <Link className="btn" href={`/compare?s=${encodeURIComponent(seriesId)}`}>
      Compare
    </Link>
  );
}

/** Share this page: "this release" and "always the latest" links (DESIGN.md 13.3). */
export function ShareButton({ path }: { path: string }) {
  const id = sheetId("share", path);
  return (
    <>
      <a className="btn" href={`#${id}`} aria-haspopup="dialog">
        Share
      </a>
      <Sheet id={id} title="Share this page">
        <ShareLinks pinned={absoluteUrl(pinnedPath(path))} latest={absoluteUrl(path)} release={RELEASE_VERSION} />
      </Sheet>
    </>
  );
}

/**
 * On a release-pinned address (/<release>/...), a line that says so. The site
 * serves the same page at both addresses (a rewrite in next.config.ts), so the
 * page learns which one it is on from the address: a script, run as the line is
 * parsed and before it is painted, shows it. Without JavaScript the line stays
 * hidden; the Share and Cite sheets still say what a pinned link does.
 */
export function PinnedLine() {
  const prefix = `/${RELEASE_VERSION}/`;
  const js = `(function(){var p=${JSON.stringify(prefix)};var l=location.pathname;if(l.indexOf(p)!==0)return;document.documentElement.setAttribute("data-pinned","");var me=document.currentScript&&document.currentScript.previousElementSibling;if(me&&!document.querySelector(".pinned-line.on"))me.classList.add("on");var a=document.querySelectorAll("a[data-pinned-latest]");for(var i=0;i<a.length;i++)a[i].setAttribute("href",l.slice(p.length-1)+location.search);})();`;
  return (
    <>
      <p className="pinned-line">
        <strong>This link will keep showing these numbers.</strong> It is pinned to release <Num kind="version">{RELEASE_VERSION}</Num>.{" "}
        {/* A plain link: the script after this line rewrites its address before the page is shown. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" data-pinned-latest="" suppressHydrationWarning>
          Open the latest release
        </a>
      </p>
      <script dangerouslySetInnerHTML={{ __html: js }} />
    </>
  );
}

/** The row itself: sticky at the bottom of the screen on phones. */
export function ActionBar({ children, label = "Actions" }: { children: React.ReactNode; label?: string }) {
  return (
    <>
      <PinnedLine />
      <div className="action-bar" role="group" aria-label={label}>
        {children}
      </div>
    </>
  );
}
