"use client";
// Receipt sections are <details>, closed in the HTML, so a phone (and a reader
// without JavaScript) gets a short page and can open any section. With
// JavaScript, on a wide screen, the sections marked data-open-wide open. A link
// to a section (#checks, #cite ...) opens the section that holds its target.
// The whole-page image sits in a closed section with loading="lazy", so it is
// not fetched until that section is opened (DESIGN.md 7.1, 14.2).
import { useEffect } from "react";

export default function ReceiptEnhance() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-receipt]");
    if (!root) return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      root.querySelectorAll<HTMLDetailsElement>("details[data-open-wide]").forEach((d) => (d.open = true));
    }
    const openTarget = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      let p: HTMLElement | null = el;
      while (p) {
        if (p instanceof HTMLDetailsElement) p.open = true;
        p = p.parentElement;
      }
      el.scrollIntoView();
    };
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);
  return null;
}
