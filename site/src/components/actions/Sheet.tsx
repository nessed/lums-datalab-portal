// A sheet that works as a plain anchor: the button is a link to #<id>, and CSS
// shows the sheet while it is the :target (a bottom sheet on phones, a panel on
// wide screens). "Close" is a link to #_ (no such element, so the page does not
// scroll). Without JavaScript that is all; SheetEnhance adds focus, Escape and
// a focus trap. Pure markup, so client components can render it too.
import type { ReactNode } from "react";
import SheetEnhance from "./SheetEnhance";

export const sheetId = (prefix: string, key: string) => {
  // A short, stable id from the key (a series id or a page path).
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `sheet-${prefix}-${h.toString(36)}`;
};

export function Sheet({ id, title, children, note }: { id: string; title: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sheet" id={id} role="dialog" aria-modal="true" aria-labelledby={`${id}-h`}>
      <a className="sheet-scrim" href="#_" tabIndex={-1} aria-hidden="true" />
      <div className="sheet-panel" tabIndex={-1}>
        <div className="sheet-head">
          <h2 id={`${id}-h`}>{title}</h2>
          <a className="btn btn-text sheet-close" href="#_">
            Close
          </a>
        </div>
        {note ? <div className="sheet-note">{note}</div> : null}
        <div className="sheet-body">{children}</div>
      </div>
      <SheetEnhance />
    </div>
  );
}
