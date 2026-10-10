import type { Metadata } from "next";
import Link from "next/link";
import { db, sourceHref } from "@/lib/data";
import { count, dateOnly, DOC_TYPE_WORDS, verificationWords } from "@/lib/format";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  const d = db();
  return (
    <>
      <h1>Source documents</h1>
      <p className="lede">
        Every figure on this site is read from one of these government documents. For each file we record where it was downloaded, when, its
        SHA-256 fingerprint, and how we confirmed it is the genuine document.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Publisher</th>
              <th scope="col">Period</th>
              <th scope="col">Verification</th>
              <th scope="col">Pages read</th>
              <th scope="col">Retrieved</th>
            </tr>
          </thead>
          <tbody>
            {d.sources.map((s) => {
              const v = verificationWords(s.verification_status);
              return (
                <tr key={s.source_id}>
                  <th scope="row" style={{ whiteSpace: "normal", minWidth: "12rem" }}>
                    <Link href={sourceHref(s.source_id)}>{s.title}</Link>
                    <div className="small muted" style={{ fontWeight: 400 }}>
                      {DOC_TYPE_WORDS[s.doc_type] ?? s.doc_type}
                    </div>
                  </th>
                  <td>{s.publisher}</td>
                  <td className="nowrap">{s.period}</td>
                  <td style={{ minWidth: "16rem" }}>
                    {v.caveat ? <span className="badge badge-gap-pending">Caveat</span> : <span className="badge badge-checked">Official file</span>}{" "}
                    <span className="small">{v.text}</span>
                  </td>
                  <td>{count((s.pages_used ?? []).length)}</td>
                  <td className="nowrap">{dateOnly(s.retrieved_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
