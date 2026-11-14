// The action row of a series or a receipt (DESIGN.md 9.5 item 4, 7.1 item 3):
// Download · Cite · Compare · Share. STUBS with fixed interfaces, so pages can
// place them now; the downloads-and-citation stage (DESIGN.md 13) replaces the
// bodies with sheets. Every one works as a plain link without JavaScript.
import Link from "@/components/ui/Link";
import { seriesCsvHref } from "@/lib/data";

/** Download for one series (all years). Primary button on a series page. */
export function DownloadButton({ seriesId, primary = true }: { seriesId: string; primary?: boolean }) {
  return (
    <a className={`btn${primary ? " btn-primary" : ""}`} href={seriesCsvHref(seriesId)} download>
      Download
    </a>
  );
}

/** Cite a series, a figure or a view. `path` is the page being cited. */
export function CiteButton({ path, primary = false }: { path: string; primary?: boolean }) {
  return (
    <Link className={`btn${primary ? " btn-primary" : ""}`} href={`${path}#cite`}>
      Cite
    </Link>
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
  return (
    <a className="btn" href={path}>
      Share
    </a>
  );
}

/** The row itself: sticky at the bottom of the screen on phones. */
export function ActionBar({ children, label = "Actions" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="action-bar" role="group" aria-label={label}>
      {children}
    </div>
  );
}
