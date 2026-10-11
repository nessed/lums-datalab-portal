"use client";
// Click the page render to see it full width in a dialog. Without JavaScript
// the figure caption links to the image file itself.
import { useRef, type ReactNode } from "react";

export default function ZoomDialog({ children, large, label, heading }: { children: ReactNode; large: ReactNode; label: string; heading: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="doc-zoom" aria-label={label} onClick={() => ref.current?.showModal()} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "zoom-in" }}>
        {children}
      </button>
      <dialog
        ref={ref}
        className="doc-dialog"
        aria-label={label}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="doc-dialog-bar">
          <span>{heading}</span>
          <button type="button" className="btn" onClick={() => ref.current?.close()} autoFocus>
            Close
          </button>
        </div>
        <div className="doc-dialog-body">{large}</div>
      </dialog>
    </>
  );
}
