// How a source file was obtained and checked: a mark and a short label, with
// the full sentence as a tooltip and on the sources page.
import { verifLong, verifShort, type VerifKey } from "@/lib/sources";

function VerifMark({ k }: { k: VerifKey }) {
  return (
    <svg className="st-mark" viewBox="0 0 10 10" aria-hidden="true">
      {k === "ok" ? <circle cx="5" cy="5" r="4.2" fill="currentColor" /> : k === "rejected" ? <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.6" /> : <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  );
}

export function VerifBadge({ status }: { status: string }) {
  const v = verifShort(status);
  return (
    <span className={`st verif--${v.key}`} title={verifLong(status)}>
      <VerifMark k={v.key} />
      <span className="st-label">{v.label}</span>
    </span>
  );
}

