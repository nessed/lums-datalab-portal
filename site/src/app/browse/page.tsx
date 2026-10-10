import type { Metadata } from "next";
import Link from "next/link";
import { DatasetBadge } from "@/components/Badges";
import { datasetKeys, db, isDatasetPublished, seriesHref, sourceHref, type Series } from "@/lib/data";
import { count, DOC_TYPE_WORDS, unitLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Browse" };

function Tree({ nodes, seen }: { nodes: Series[]; seen: Set<string> }) {
  const d = db();
  return (
    <>
      {nodes.map((s) => {
        if (seen.has(s.series_id)) return null;
        seen.add(s.series_id);
        const all = d.obsBySeries.get(s.series_id) ?? [];
        const pub = all.filter((o) => o.published).length;
        const kids = d.childrenOf.get(s.series_id) ?? [];
        return (
          <li key={s.series_id}>
            <Link href={seriesHref(s.series_id)}>{s.name}</Link>
            <span className="tree-meta">
              {unitLabel(s.unit, s.scale_factor)}
              {s.derived ? ", computed" : ""} &middot; {count(pub)} checked, {count(all.length - pub)} gaps
            </span>
            {kids.length > 0 && (
              <ul>
                <Tree nodes={kids} seen={seen} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

export default function BrowsePage() {
  const d = db();
  const keys = datasetKeys();
  const docTypes = [...new Set(d.sources.map((s) => s.doc_type))];
  return (
    <>
      <h1>Browse</h1>
      <p className="lede">Find a series by dataset, or start from a government document.</p>
      <p className="small">
        On this page: <a href="#by-dataset">by dataset</a> &middot; <a href="#by-document">by document</a>
      </p>

      <h2 id="by-dataset">By dataset</h2>
      {keys.map((key) => {
        const ds = d.release.dataset_status[key];
        const roots = (d.childrenOf.get("") ?? []).filter((s) => s.dataset === key);
        const total = d.series.filter((s) => s.dataset === key).length;
        return (
          <section key={key} id={key}>
            <h3>
              {ds?.name ?? key} <DatasetBadge state={ds?.state ?? "coming"} />
            </h3>
            {isDatasetPublished(key) ? (
              roots.length > 0 ? (
                <>
                  <p className="small muted">{count(total)} series. Indented series are parts of the series above them.</p>
                  <ul className="tree">
                    <Tree nodes={roots} seen={new Set()} />
                  </ul>
                </>
              ) : (
                <p className="small">No series in this release.</p>
              )
            ) : (
              <p className="small">
                Coming. No values from this dataset are published in this release.
                {ds?.reasons && ds.reasons.length > 0 ? ` Reason: ${ds.reasons.join("; ")}.` : ""}
              </p>
            )}
          </section>
        );
      })}

      <h2 id="by-document">By document</h2>
      {docTypes.map((t) => (
        <section key={t}>
          <h3>{DOC_TYPE_WORDS[t] ?? t}</h3>
          <ul>
            {d.sources
              .filter((s) => s.doc_type === t)
              .map((s) => {
                const used = (s.pages_used ?? []).length;
                return (
                  <li key={s.source_id}>
                    <Link href={sourceHref(s.source_id)}>{s.title}</Link>{" "}
                    <span className="tree-meta">{used > 0 ? `${count(used)} ${used === 1 ? "page" : "pages"} read in this release` : "registered; no values read from it yet"}</span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <p className="small">
        <Link href="/sources">All source documents, with verification details</Link>.
      </p>
    </>
  );
}
