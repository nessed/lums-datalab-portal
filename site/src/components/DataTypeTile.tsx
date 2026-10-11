// One data type as a tile: name, publisher, counts and span, all read from
// the release. Used on the home page and the data types index.
import Link from "next/link";
import { Count, Num } from "@/components/ui/Num";
import { datasetName } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { datasetStats } from "@/lib/stats";

const DOC_WORD: Record<string, [string, string]> = {
  fiscal_year: ["Fiscal years", "editions"],
  month: ["Months", "issues"],
  survey_round: ["Rounds", "reports"],
};

export default function DataTypeTile({ k }: { k: string }) {
  const st = datasetStats(k);
  const [periodWord, docWord] = DOC_WORD[st.frequency ?? ""] ?? ["Periods", "documents"];
  const first = st.periods[0];
  const last = st.periods[st.periods.length - 1];
  return (
    <li className="dt-tile">
      <h3>
        <Link href={`/datasets/${k}`}>{datasetName(k)}</Link>
      </h3>
      {st.publisher ? <p className="dt-pub">{st.publisher}</p> : null}
      <p className="dt-counts">
        <Count k={`series:${k}`} n={st.series} /> series · <Count k={`values:${k}`} n={st.values} /> checked values
      </p>
      {first ? (
        <p className="dt-span">
          {periodWord} <Num kind="period">{periodWords(first, st.frequency)}</Num> to <Num kind="period">{periodWords(last, st.frequency)}</Num> ·{" "}
          <Count k={`docs:${k}`} n={st.docs.length} /> {docWord}
        </p>
      ) : null}
      <p className="dt-links">
        <Link href={`/browse?dataset=${k}`}>Browse its series</Link> · <Link href={`/datasets/${k}#tables`}>Tables as printed</Link>
      </p>
    </li>
  );
}

