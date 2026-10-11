"use client";
// A code block with a copy button. "{{ORIGIN}}" in the code is replaced by
// this site's address in the browser (the server render shows a neutral
// placeholder), so snippets work wherever the site is deployed.
import { useSyncExternalStore } from "react";
import CopyButton from "./CopyButton";

export default function Code({ code, label }: { code: string; label: string }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://<this site>",
  );
  const text = code.replaceAll("{{ORIGIN}}", origin);
  return (
    <div className="code-block">
      <div className="code-bar">
        <span className="small muted">{label}</span>
        <CopyButton text={text} label="Copy" className="btn btn-text" />
      </div>
      <pre className="code" data-num="id">
        {text}
      </pre>
    </div>
  );
}
