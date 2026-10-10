// Client-side search over the prebuilt index (public/data/<version>/search.json,
// written by scripts/prebuild.mjs). Plain token matching; no library.

export type SearchEntry = {
  k: "s" | "d"; // series | document
  id: string;
  n: string; // name
  d: string; // dataset or document type
  u?: string; // unit in words
  f?: string; // frequency
  p?: string; // periods covered
  c?: number; // published values
  y?: string; // synonyms
  x?: number; // derived
  h: string; // href
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();

export function tokens(q: string): string[] {
  return norm(q).split(/\s+/).filter(Boolean);
}

/** Every token must match somewhere; matches in the name score highest. */
export function search(index: SearchEntry[], q: string, limit = 30): SearchEntry[] {
  const ts = tokens(q);
  if (ts.length === 0) return [];
  const scored: { e: SearchEntry; s: number }[] = [];
  for (const e of index) {
    const name = norm(e.n);
    const hay = `${name} ${norm(e.id)} ${norm(e.y ?? "")} ${norm(e.d)} ${norm(e.p ?? "")}`;
    let s = 0;
    let ok = true;
    for (const t of ts) {
      if (!hay.includes(t)) {
        ok = false;
        break;
      }
      if (new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(name)) s += 10;
      else if (name.includes(t)) s += 6;
      else if (norm(e.y ?? "").includes(t)) s += 4;
      else s += 1;
    }
    if (!ok) continue;
    if (e.k === "s" && (e.c ?? 0) === 0) s -= 3; // series with no values yet sink
    if (e.x) s -= 1;
    s -= name.length / 200; // shorter, more general names first
    scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.e);
}
