"use client";
// Text with "{{ORIGIN}}" in it (a link or a citation built while the site's
// address is not configured): the browser fills in the address it was served
// from. The server render, and a reader without JavaScript, see the site path.
import { useSyncExternalStore } from "react";
import CopyButton from "@/components/ui/CopyButton";

const useOrigin = () =>
  useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

export function OriginText({ text }: { text: string }) {
  return <>{text.replaceAll("{{ORIGIN}}", useOrigin())}</>;
}

export function OriginCopy({ text, label, className }: { text: string; label: string; className?: string }) {
  return <CopyButton text={text.replaceAll("{{ORIGIN}}", useOrigin())} label={label} className={className} />;
}
