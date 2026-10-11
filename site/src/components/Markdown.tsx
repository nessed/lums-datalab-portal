// A very small Markdown renderer for the release's own .md files (headings,
// paragraphs, lists, block quotes, fenced code, pipe tables, inline code,
// bold, italics, links). Raw HTML is never interpreted.
import type { ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)|(https?:\/\/[^\s)>\]]+[^\s)>\].,;:])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (m[3]) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const safe = /^(https?:|mailto:|\/|#)/.test(mm[2]);
      out.push(
        safe ? (
          <a key={key} href={mm[2]}>
            {inline(mm[1], key)}
          </a>
        ) : (
          mm[1]
        ),
      );
    } else if (m[4]) out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    else
      out.push(
        <a key={key} href={tok}>
          {tok}
        </a>,
      );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Anchor for a heading: "Two separate questions: how much..." -> "two-separate-questions-how-much". */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Headings of a Markdown document at one level, for a table of contents. */
export function markdownHeadings(source: string, level = 2): { id: string; label: string }[] {
  const re = new RegExp("^#{" + level + "}\\s+(.*)$");
  return source
    .split(/\r?\n/)
    .map((l) => re.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ id: headingSlug(m[1]), label: m[1].replace(/[`*]/g, "") }));
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const LIST_RE = /^\s*([-*+]|\d+\.)\s+(.*)$/;
const RULE_RE = /^(-{3,}|\*{3,})\s*$/;
const FENCE = "```";

export default function Markdown({ source, headingOffset = 1 }: { source: string; headingOffset?: number }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const isSpecial = (l: string) => /^(#{1,6}\s|>|\|)/.test(l) || l.startsWith(FENCE) || LIST_RE.test(l) || RULE_RE.test(l);
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith(FENCE)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(FENCE)) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key} className="code">
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(6, h[1].length + headingOffset);
      const Tag = `h${level}` as "h2";
      blocks.push(
        <Tag key={key} id={headingSlug(h[2])}>
          {inline(h[2], key)}
        </Tag>,
      );
      i++;
      continue;
    }
    if (RULE_RE.test(line)) {
      blocks.push(<hr key={key} />);
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key}>{inline(buf.join(" "), key)}</blockquote>);
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={key} className="table-wrap" role="region" aria-label={head.join(", ").slice(0, 80) || "Table"} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j} scope="col">
                    {inline(c, `${key}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j}>{inline(c, `${key}r${ri}c${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const li = LIST_RE.exec(line);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m) {
          items.push(m[2]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        } else break;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key}>
          {items.map((t, j) => (
            <li key={j}>{inline(t, `${key}i${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={key}>{inline(buf.join(" "), key)}</p>);
  }
  return <div className="prose">{blocks}</div>;
}
