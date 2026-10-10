import { CHECKED_HELP, CHECK_RESULT_WORDS, GAP_EXPLAIN, gapWords, statusWords } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  if (status === "checked") {
    return (
      <span className="badge badge-checked" title={CHECKED_HELP}>
        <span aria-hidden="true">&#10003;</span> Checked
      </span>
    );
  }
  return <span className={`badge badge-${status === "disputed" ? "fail" : "muted"}`}>{statusWords(status)}</span>;
}

export function GapBadge({ kind }: { kind: string | null }) {
  const cls = kind === "not_in_source" ? "badge-gap-source" : kind === "failed_checks" ? "badge-gap-failed" : "badge-gap-pending";
  return (
    <span className={`badge ${cls}`} title={kind ? GAP_EXPLAIN[kind] : undefined}>
      {gapWords(kind)}
    </span>
  );
}

export function CheckBadge({ result }: { result: string }) {
  const cls =
    result === "pass" ? "badge-checked" : result === "pass_within_rounding" ? "badge-rounding" : result === "fail" ? "badge-fail" : "badge-muted";
  return (
    <span className={`badge ${cls}`}>
      {result === "pass" || result === "pass_within_rounding" ? <span aria-hidden="true">&#10003; </span> : null}
      {CHECK_RESULT_WORDS[result] ?? result}
    </span>
  );
}

export function DatasetBadge({ state }: { state: string }) {
  return state === "published" ? (
    <span className="badge badge-checked">Published</span>
  ) : (
    <span className="badge badge-gap-pending">Coming</span>
  );
}
