// The editorial files (site/editorial/*.json), read at build time and cut down
// to what the release can fill: a series id the release does not hold, holds
// in a dataset that is not visible, or holds without a figure that may be
// shown, is dropped; a topic or question left empty is dropped too. Nothing is
// ever filled in. scripts/checks/home-editorial.mjs checks the files
// themselves (provisional flag, no numbers, ids that exist).
import topicsFile from "../../../editorial/topics.json";
import { seriesTitle } from "@/lib/titles";
import questionsFile from "../../../editorial/questions.json";
import headlineFile from "../../../editorial/headline.json";
import { db, isDatasetPublished, type Series } from "@/lib/data";
import type { KindKey } from "@/lib/adapter/contract";
import { latestShown, showable } from "./derive";

export type TopicGroup = { heading: string; series: Series[] };
export type Topic = {
  slug: string;
  name: string;
  short: string;
  definition: string;
  headline: Series[];
  groups: TopicGroup[];
  revisions: { heading: string; series: Series[] } | null;
  questions: string[];
  limits: string[];
  gaps: string[];
};

export type QuestionPart = { series: Series; kind: KindKey; subject: string; label: string; heading: string | null };
export type Question = { slug: string; topic: string; question: string; title: string; parts: QuestionPart[] };

export type HeadlineCard = { series: Series; kind: KindKey; name: string; topic: string };

/** A series the release holds in a visible dataset, with at least one figure that may be shown. */
function seriesWithData(id: string): Series | undefined {
  const s = db().seriesById.get(id);
  if (!s || !isDatasetPublished(s.dataset)) return undefined;
  return (db().obsBySeries.get(id) ?? []).some(showable) ? s : undefined;
}

/** Same, and it has a showable figure of this kind. */
function seriesWithKind(id: string, kind: string): Series | undefined {
  const s = seriesWithData(id);
  return s && latestShown(db().obsBySeries.get(id) ?? [], kind).latest ? s : undefined;
}

const keep = <T,>(x: T | undefined): x is T => x !== undefined;

let topicsCache: Topic[] | null = null;
export function topics(): Topic[] {
  if (topicsCache) return topicsCache;
  const qs = new Set(questions().map((q) => q.slug));
  topicsCache = topicsFile.topics
    .map((t) => {
      const groups = t.groups.map((g) => ({ heading: g.heading, series: g.series.map(seriesWithData).filter(keep) })).filter((g) => g.series.length > 0);
      const rev = (t as { revisions?: { heading: string; series: string[] } }).revisions;
      return {
        slug: t.slug,
        name: t.name,
        short: t.short,
        definition: t.definition,
        headline: t.headline.map(seriesWithData).filter(keep),
        groups,
        revisions: rev ? { heading: rev.heading, series: rev.series.map(seriesWithData).filter(keep) } : null,
        questions: t.questions.filter((q) => qs.has(q)),
        limits: t.limits,
        gaps: t.gaps,
      };
    })
    // A topic without checked data is not shown (DESIGN.md 9.1).
    .filter((t) => t.groups.length > 0);
  return topicsCache;
}

export function topicBySlug(slug: string): Topic | undefined {
  return topics().find((t) => t.slug === slug);
}

let questionsCache: Question[] | null = null;
export function questions(): Question[] {
  if (questionsCache) return questionsCache;
  questionsCache = questionsFile.questions
    .map((q) => ({
      slug: q.slug,
      topic: q.topic,
      question: q.question,
      title: q.title,
      parts: q.parts
        .map((p) => {
          const s = seriesWithKind(p.series, p.kind);
          return s ? { series: s, kind: p.kind as KindKey, subject: p.subject, label: p.label, heading: (p as { heading?: string }).heading ?? null } : undefined;
        })
        .filter(keep),
    }))
    .filter((q) => q.parts.length > 0);
  return questionsCache;
}

export function questionBySlug(slug: string): Question | undefined {
  return questions().find((q) => q.slug === slug);
}

export function headlineCards(): HeadlineCard[] {
  return headlineFile.cards
    .map((c) => {
      const s = seriesWithKind(c.series, c.kind);
      // The card keeps its editorial name only where it is the series' plain title; otherwise the title (round 2).
      return s ? { series: s, kind: c.kind as KindKey, name: c.name === seriesTitle(s) ? c.name : seriesTitle(s), topic: c.topic } : undefined;
    })
    .filter(keep)
    .slice(0, 6);
}

export const answerHref = (slug: string) => `/answers/${slug}`;
export const topicHref = (slug: string) => `/topics/${slug}`;
