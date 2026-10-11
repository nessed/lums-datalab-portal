// Every source document, how we know each file is genuine, and what this
// release reads from it.
import type { Metadata } from "next";
import Link from "next/link";
import { Bar, Breadcrumbs, TableWrap } from "@/components/ui/Basics";
import { db, sourceHref } from "@/lib/data";
import { count, DOC_TYPE_WORDS, pct, ROLE_WORDS } from "@/lib/format";
import { VerifBadge } from "@/components/ui/Verif";
import { ROLE_SHORT, sourceCoverage, valuesFromSource, verifLong, VERIF_SHORT } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Source documents",
  description: "The government documents behind every figure: where each file came from, how it was verified, which pages were read and how much of each table was captured.",
};

export default function SourcesPage() {
  const d = db();
  const types = [...new Set(d.sources.map((s) => s.doc_type))];
  const used = new Set(d.sources.map((s) => s.verification_status));
  const keyed = Object.keys(VERIF_SHORT).filter((k) => used.has(k));
  return (
    <>
      <Breadcrumbs items={[{ label: "Sources" }]} />
      <header className="page-head">
        <h1>Source documents</h1>
        <p className="lede">
          Every figure on this site is read from one of these {d.sources.length} government files. For each one we record where it was downloaded,
          its SHA-256 fingerprint, and how we confirmed it is the genuine document. Files are never edited.
        </p>
      </header>

      <section aria-labelledby="key-h" className="verif-key">
        <h2 id="key-h">How each file was obtained and checked</h2>
        <dl>
          {keyed.map((k) => (
            <div key={k}>
              <dt>
                <VerifBadge status={k} />
              </dt>
              <dd>{verifLong(k)}</dd>
            </div>
          ))}
        </dl>
        <p className="small muted measure">
          {Object.entries(ROLE_WORDS)
            .map(([k, v]) => `${ROLE_SHORT[k] ?? k}: ${v.split(": ")[1] ?? v}`)
            .join(" ")}{" "}
          Coverage is how much of the printed tables we captured; it says nothing about whether the captured numbers are right, which is what the
          checks are for.
        </p>
      </section>

      {types.map((t) => {
        const list = d.sources.filter((s) => s.doc_type === t);
        return (
          <section key={t} aria-labelledby={`t-${t}`}>
            <h2 id={`t-${t}`}>{DOC_TYPE_WORDS[t] ?? t.replaceAll("_", " ")}</h2>
            <p className="small muted">
              {list[0]?.publisher}. {list.length} {list.length === 1 ? "file" : "files"}.
            </p>
            <TableWrap label={`${DOC_TYPE_WORDS[t] ?? t} files`} sticky>
              <table className="src-table">
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Role</th>
                    <th scope="col">File</th>
                    <th scope="col" className="num">
                      Pages read
                    </th>
                    <th scope="col">Coverage of tables read</th>
                    <th scope="col" className="num">
                      Values
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const cov = sourceCoverage(s);
                    const pages = (s.pages_used ?? []).length;
                    return (
                      <tr key={s.source_id} className={s.verification_status === "failed" ? "is-rejected" : undefined}>
                        <th scope="row">
                          <Link href={sourceHref(s.source_id)}>{s.title}</Link>
                          <span className="cell-sub">{s.period}</span>
                        </th>
                        <td className="small">{ROLE_SHORT[s.role] ?? s.role}</td>
                        <td>
                          <VerifBadge status={s.verification_status} />
                        </td>
                        <td className="num">{pages ? count(pages) : <span className="muted">none</span>}</td>
                        <td className="small">
                          {cov.ratio !== null ? (
                            <Bar ratio={cov.ratio} label={`${pct(cov.ratio)} (${count(cov.matched)} of ${count(cov.printed)})`} />
                          ) : (
                            <span className="muted">not measured</span>
                          )}
                        </td>
                        <td className="num">{count(valuesFromSource(s.source_id))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </section>
        );
      })}
    </>
  );
}
