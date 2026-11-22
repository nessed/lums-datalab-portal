// What a figure is and when, in full words, for the Indicators and Stories
// pages (first layer: no "BE"/"RE", no "survey round"): "budget estimate,
// 2026-27", "June 2026, change over a year". Words from KIND (lib/words.ts).
import type { ReactNode } from "react";
import { Num } from "@/components/ui/Num";
import type { Observation, Series } from "@/lib/data";
import { periodWords } from "@/lib/format";
import { KIND, STAGE_KINDS } from "@/lib/words";
import type { KindKey } from "@/lib/adapter/contract";

export function basis(o: Observation, s: Series): ReactNode {
  const period = <Num kind="period">{periodWords(o.period, s.frequency)}</Num>;
  const k = o.kind as KindKey;
  if (STAGE_KINDS.includes(k))
    return (
      <>
        {KIND[k].long}, {period}
      </>
    );
  if (k === "survey_round") return <>survey of {period}</>;
  if (k === "as_printed" || !KIND[k]) return period;
  return (
    <>
      {period}, {KIND[k].long}
    </>
  );
}
