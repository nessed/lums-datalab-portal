"use client";
// Receipt sections are <details>, closed in the HTML, so a phone (and a reader
// without JavaScript) gets a short page and can open any section. With
// JavaScript, on a wide screen, the sections marked data-open-wide open. A link
// to a section (#checks, #cite ...) opens the section that holds its target.
// Images in a closed section keep their address in data-src and are fetched
// only when the section opens (DESIGN.md 7.1, 14.2); without JavaScript they
// are not fetched at all, and the section links to the page image instead.
import { useEffect } from "react";

export default function ReceiptEnhance() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-receipt]");
    if (!root) return;
    // Images in a section wait in data-src until the section is opened.
    const load = (d: Element) => d.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
      img.src = img.dataset.src!;
      img.removeAttribute("data-src");
    });
    const onToggle = (e: Event) => {
      if (e.target instanceof HTMLDetailsElement && e.target.open) load(e.target);
    };
    root.addEventListener("toggle", onToggle, true);
    root.querySelectorAll("details[open]").forEach(load);
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
    return () => {
      window.removeEventListener("hashchange", openTarget);
      root.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
