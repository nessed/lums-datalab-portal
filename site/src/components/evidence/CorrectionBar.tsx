// The correction bar (DESIGN.md 8.4): loud, dated, above the fold, on the
// receipt of a figure we published wrongly. A slot only: no release holds a
// correction yet, and the contract's Db has no corrections list, so receipts
// pass an empty list and nothing renders. When the adapter provides
// corrections (5.1 "Correction"), pass them here. Routine revisions (budget
// estimate to revised estimate) are not corrections and never use this bar.
import Link from "@/components/ui/Link";
import { Num } from "@/components/ui/Num";
import type { ReactNode } from "react";

export type CorrectionNote = {
  /** ISO date of the correction. */
  date: string;
  /** Release that made it. */
  release: string;
  /** What we had and what the printed figure is, each already a checked value or printed reading element. */
  was: ReactNode;
  now: ReactNode;
  cause: string;
  /** The superseded receipt, at its release-pinned URL. */
  supersededHref: string;
};

export default function CorrectionBar({ corrections }: { corrections: CorrectionNote[] }) {
  if (corrections.length === 0) return null;
  return (
    <div className="ev-correction" role="note" aria-label="Correction">
      {corrections.map((c) => (
        <p key={`${c.release}-${c.date}`}>
          <strong>
            Corrected <Num kind="date">{c.date}</Num> (release <Num kind="version">{c.release}</Num>):
          </strong>{" "}
          we had {c.was}; the printed figure is {c.now}. Cause: {c.cause} <Link href={c.supersededHref}>See the superseded receipt</Link>.
        </p>
      ))}
    </div>
  );
}
