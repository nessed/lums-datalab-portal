import type { Metadata } from "next";
import Cite from "@/components/Cite";
import Markdown from "@/components/Markdown";
import { DATA_BASE, db, releaseFileExists, releaseMarkdown } from "@/lib/data";

export const metadata: Metadata = { title: "Releases" };

const DOCS = [
  { id: "changelog", file: "CHANGELOG.md", title: "Changelog" },
  { id: "errata", file: "ERRATA.md", title: "Errata" },
  { id: "dataset-card", file: "dataset_card.md", title: "Dataset card" },
  { id: "reproduce", file: "HOW_TO_REPRODUCE.md", title: "How to reproduce" },
];

const DOWNLOADS = [
  { file: "observations.csv", label: "All observations (CSV, with provenance columns)" },
  { file: "observations.json", label: "All observations (JSON)" },
  { file: "series.json", label: "Series definitions (JSON)" },
  { file: "cells.json", label: "Printed cells with page positions (JSON)" },
  { file: "checks.json", label: "Checks (JSON)" },
  { file: "sources.json", label: "Source documents (JSON)" },
  { file: "coverage.json", label: "Coverage per table (JSON)" },
  { file: "release.json", label: "Release record (JSON)" },
];

export default function ReleasesPage() {
  const r = db().release;
  return (
    <>
      <h1>Releases</h1>
      <p className="lede">
        Data is published as frozen, versioned releases. A published figure is never changed silently: a correction makes a new release and an
        entry in the errata.
      </p>
      <dl className="facts">
        <dt>Current release</dt>
        <dd>
          <span className="mono">{r.version}</span> ({r.label})
        </dd>
        <dt>Built</dt>
        <dd>{r.created_at}</dd>
        <dt>Code commit</dt>
        <dd className="mono small">{r.git_commit}</dd>
        <dt>DOI</dt>
        <dd>{r.doi ? r.doi : "No DOI yet. This is a prototype release; do not cite it in publications."}</dd>
        {r.notes && (
          <>
            <dt>Release notes</dt>
            <dd>{r.notes}</dd>
          </>
        )}
      </dl>
      <Cite path="/releases" />

      <h2>Downloads</h2>
      <ul>
        {DOWNLOADS.filter((f) => releaseFileExists(f.file)).map((f) => (
          <li key={f.file}>
            <a href={`${DATA_BASE}/${f.file}`} download>
              {f.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="small">Data licence: CC BY 4.0. Figures that are gaps have no value in these files, only the kind of gap and the reason.</p>

      {DOCS.map((doc) => {
        const md = releaseMarkdown(doc.file);
        return (
          <section key={doc.id} id={doc.id}>
            <h2>{doc.title}</h2>
            {md ? <Markdown source={md} headingOffset={2} /> : <p className="muted">This release does not include {doc.file}.</p>}
          </section>
        );
      })}
    </>
  );
}
