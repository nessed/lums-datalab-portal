"use client";
// With JavaScript, an open sheet (the :target .sheet) gets focus, keeps Tab
// inside it and closes with Escape; closing returns focus to the link that
// opened it and takes the hash out of the URL (Back closes it too, because the
// sheet was opened by a link). One set of listeners per page, however many
// sheets there are.
import { useEffect } from "react";

let installed = false;

function openSheet(): HTMLElement | null {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return null;
  const el = document.getElementById(id);
  return el && el.classList.contains("sheet") ? el : null;
}

function install() {
  let opener: HTMLElement | null = null;
  let openedHere = false;
  const focusables = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, pre[tabindex], [tabindex]:not([tabindex="-1"])')].filter(
      (e) => e.offsetParent !== null,
    );
  const close = () => {
    // A navigation, not replaceState: :target only updates on navigation.
    if (openedHere) window.history.back();
    else window.location.hash = "_";
  };
  const sync = () => {
    const s = openSheet();
    if (s) {
      s.querySelector<HTMLElement>(".sheet-panel")?.focus({ preventScroll: true });
    } else if (opener) {
      opener.focus({ preventScroll: true });
      opener = null;
      openedHere = false;
    }
  };
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (href === "#_" && openSheet()) {
      e.preventDefault();
      close();
      return;
    }
    if (href.startsWith("#sheet-")) {
      opener = a;
      openedHere = true;
    }
  });
  document.addEventListener("keydown", (e) => {
    const s = openSheet();
    if (!s) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      const f = focusables(s);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === s.querySelector(".sheet-panel"))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("hashchange", sync);
  sync();
}

export default function SheetEnhance() {
  useEffect(() => {
    if (installed) return;
    installed = true;
    install();
  }, []);
  return null;
}
