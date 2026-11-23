"use client";
// The inflation calculator's form (2026-11-23). Progressive enhancement: the
// server renders this with the default amount and months, so the HTML already
// holds the default result (a derived figure, data-derived="cpi-worth", that
// scripts/checks/calc-inflation.mjs recomputes and claims) and, beside it, the
// two index values as <V> links with their pages. Those links and pages are
// rendered on the server and passed in (`slots`); this component only picks which
// ones to show. Without JavaScript the page shows the default result and the
// table of every index value. With it, a reader's own amount and months are
// worked out in the browser by the same exact function the server used
// (cpi-worth.ts), from the same index values the page prints.
import { useId, useState, type ReactNode } from "react";
import { groupDigits, parseAmount, worthText } from "./cpi-worth";

export type CalcPoint = { key: string; label: string; value: string };
export type CalcSlot = { idx: ReactNode; page: ReactNode };

export default function InflationCalc({
  points,
  slots,
  defaultAmount,
  defaultFrom,
  defaultTo,
}: {
  points: CalcPoint[];
  slots: Record<string, CalcSlot>;
  defaultAmount: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const id = useId();
  const [typed, setTyped] = useState(groupDigits(defaultAmount));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const byKey = new Map(points.map((p) => [p.key, p]));
  const a = parseAmount(typed);
  const pf = byKey.get(from);
  const pt = byKey.get(to);
  const text = a && pf && pt ? worthText(a, pf.value, pt.value) : null;

  return (
    <div className="ic-calc">
      <form className="ic-form" onSubmit={(e) => e.preventDefault()} aria-describedby={`${id}-out`}>
        <label className="ic-field">
          <span className="ic-l">Amount, rupees</span>
          <input
            className="ic-in"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={a ? undefined : true}
          />
        </label>
        <label className="ic-field">
          <span className="ic-l">In</span>
          <select className="ic-in" data-calc="from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {points.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ic-field">
          <span className="ic-l">Worth in</span>
          <select className="ic-in" data-calc="to" value={to} onChange={(e) => setTo(e.target.value)}>
            {points.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </form>
      <div className="ic-out" id={`${id}-out`} aria-live="polite">
        {text && a && pf && pt ? (
          <>
            <p className="ic-line">
              Rs <span data-num="ui">{groupDigits(a)}</span> in <span data-num="period">{pf.label}</span> buys what this buys in <span data-num="period">{pt.label}</span>:
            </p>
            <p className="ic-big">
              Rs{" "}
              <span data-num="derived" data-derived="cpi-worth" data-amount={a} data-inputs={`${pf.key} ${pt.key}`}>
                {text}
              </span>
            </p>
            <p className="ic-inputs">
              Index in <span data-num="period">{pf.label}</span>: {slots[pf.key]?.idx} ({slots[pf.key]?.page}); in <span data-num="period">{pt.label}</span>: {slots[pt.key]?.idx} (
              {slots[pt.key]?.page}).
            </p>
          </>
        ) : (
          <p className="ic-line ic-bad">Type an amount in whole rupees, without decimals.</p>
        )}
      </div>
    </div>
  );
}
