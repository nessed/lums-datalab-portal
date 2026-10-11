"use client";
// Reverses the rows of a server-rendered table (oldest first <-> newest first).
// The order lives in the URL (?order=desc). Without JavaScript the table stays
// in period order.
import { useEffect } from "react";
import { setQuery, useQuery } from "@/lib/url-state";

export default function SortToggle({ target }: { target: string }) {
  const desc = useQuery().get("order") === "desc";
  useEffect(() => {
    const body = document.getElementById(target);
    if (!body) return;
    const isDesc = body.dataset.order === "desc";
    if (isDesc !== desc) {
      [...body.children].reverse().forEach((r) => body.appendChild(r));
      body.dataset.order = desc ? "desc" : "asc";
    }
  }, [desc, target]);
  return (
    <button type="button" className="btn btn-text" onClick={() => setQuery({ order: desc ? null : "desc" }, "replace")}>
      {desc ? "Oldest first" : "Newest first"}
    </button>
  );
}
