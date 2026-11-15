// The versions strip (DESIGN.md 8.1): every printing of this series and
// period, oldest first, each linked to its receipt, with the change between
// two kinds of figure computed at build time from checked values only. The
// change is annotated (data-num="derived" data-derived="pct-change") and
// scripts/checks/evidence-sheet.mjs recomputes it from the release.
import Link from "@/components/ui/Link";
import { Num, V } from "@/components/ui/Num";
import { db, obsHref } from "@/lib/data";
import type { Versions } from "./model";

function stepWords(dir: "up" | "down" | "same" | null, fromKind: string): string {
  const k = fromKind.toLowerCase();
  if (dir === "same") return ` change from the ${k}`;
  return ` on the ${k}`;
}

export default function VersionsStrip({ versions, compact }: { versions: Versions; compact?: boolean }) {
  const d = db();
  const { items, steps, missing } = versions;
  const single = items.length === 1 && missing.length === 0;
  return (
    <section className={`ev-versions${compact ? " is-compact" : ""}`} aria-labelledby="versions-h">
      <h2 id="versions-h" className="ev-versions-h">
        Versions of this figure
      </h2>
      <ol className="ev-vs">
        {items.map((it, i) => {
          const o = d.obsById.get(it.obsId)!;
          const step = i > 0 ? steps[i - 1] : null;
          const prev = i > 0 ? items[i - 1] : null;
          return [
            step ? (
              <li key={`s${i}`} className="ev-vs-step">
                <span aria-hidden="true">↓ </span>
                {step.pct ? (
                  <>
                    <span data-num="derived" data-derived="pct-change" data-from={step.from} data-to={step.to} className="ev-vs-pct">
                      {step.pct}
                    </span>
                    {stepWords(step.dir, prev!.kindWord)}
                    {step.dir === "up" ? ", revised up" : step.dir === "down" ? ", revised down" : ""}
                  </>
                ) : (
                  <span className="muted">No change shown: {step.reason}.</span>
                )}
              </li>
            ) : null,
            <li key={it.obsId} className={`ev-vs-item${it.isThis ? " is-this" : ""}`}>
              <span className="ev-vs-kind">
                {it.kindWord}
                {it.kindWord !== "As printed" ? (
                  <>
                    {" "}
                    <Num kind="period">{it.periodWords}</Num>
                  </>
                ) : null}
                {it.printedIn.length ? (
                  <span className="ev-vs-where">
                    {" "}
                    (printed in <Num kind="text">{it.printedIn[0].title}</Num>
                    {it.printedIn.slice(1).map((p) => (
                      <span key={p.sourceId}>
                        , and again in <Num kind="text">{p.title}</Num>
                      </span>
                    ))}
                    )
                  </span>
                ) : null}
                :
              </span>{" "}
              <span className="ev-vs-val">
                {it.value !== null ? (
                  <>
                    <V o={o} /> {it.unit}
                  </>
                ) : (
                  <Link href={obsHref(it.obsId)} className="ev-vs-gap">
                    {it.word}
                  </Link>
                )}
                {it.isThis ? <span className="ev-vs-this"> (this receipt)</span> : null}
              </span>
            </li>,
          ];
        })}
        {missing.map((m) => (
          <li key={m} className="ev-vs-item ev-vs-missing">
            {m}
          </li>
        ))}
      </ol>
      {single ? <p className="ev-vs-note small muted">This release holds one printing of this figure.</p> : null}
    </section>
  );
}
