// Compare provinces (2026-11-23, Compare Provinces design): education, health,
// police and courts, and development budgets of the four provinces side by side.
// This release holds no provincial budget (its datasets are the federal budget,
// consumer prices and the labour force survey; feature flag provincialBudgets is
// off), so each category shows the design's "not here yet" state honestly: the
// four provinces, each with a labelled gap and no number of any kind, the
// category tabs, a note, and links to what the release does hold by province and
// to the federal figures. The design's figures were placeholders; none is used.
// The chart builder at /compare (compare/page.tsx) is a different page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { db, isDatasetPublished, seriesHref } from "@/lib/data";
import { isOn } from "@/lib/features";
import { seriesTitle } from "@/lib/titles";

type Category = { slug: string; label: string; lower: string; federal: string[] };

const CATEGORIES: Category[] = [
  { slug: "education", label: "Education", lower: "education", federal: ["fed.exp.current.function.education_affairs_and_services"] },
  { slug: "health", label: "Health", lower: "health", federal: ["fed.exp.current.function.health"] },
  { slug: "police", label: "Police and courts", lower: "police and courts", federal: ["fed.exp.current.function.public_order_and_safety_affairs"] },
  { slug: "development", label: "Development", lower: "development", federal: ["fed.exp.development.total"] },
];

const PROVINCES = ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan"];

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

type Props = { params: Promise<{ category: string }> };

const bySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = bySlug((await params).category);
  return c
    ? {
        title: `${c.label} budgets by province`,
        description: `Provincial ${c.lower} budgets of Punjab, Sindh, Khyber Pakhtunkhwa and Balochistan: not on this site yet. What it holds by province instead.`,
      }
    : {};
}

export default async function CompareProvinces({ params }: Props) {
  const c = bySlug((await params).category);
  if (!c) notFound();
  // Provincial budgets are not collected. If the flag is ever switched on, this
  // page must be rebuilt around real figures; lib/features.ts fails the build first.
  const live = isOn("provincialBudgets");
  const d = db();
  const federal = c.federal.map((id) => d.seriesById.get(id)).filter((s) => !!s && isDatasetPublished(s.dataset));
  const lfs = isDatasetPublished("lfs");
  return (
    <div className="pg cp" data-state={live ? "live" : "not-collected"}>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/topics/provinces", label: "Provinces" }, { label: `Compare provinces: ${c.lower}` }]} />
      <h1 className="pg-h1 cp-h1">
        Provincial {c.lower} budgets for Punjab, Sindh, Khyber Pakhtunkhwa and Balochistan are not on this site yet.
      </h1>

      <nav className="cp-tabs" aria-label="Kind of spending">
        <ul>
          {CATEGORIES.map((x) => (
            <li key={x.slug}>
              <Link href={`/compare/${x.slug}`} className="cp-tab" aria-current={x.slug === c.slug ? "page" : undefined}>
                {x.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="cp-grid" aria-label={`${c.label} budgets by province`}>
        {PROVINCES.map((p) => (
          <li key={p} className="cp-prov">
            <h2 className="cp-name">{p}</h2>
            <p className="cp-gap">
              <span className="cp-gap-mark" aria-hidden="true" />
              Not collected yet
            </p>
            <p className="cp-from">Would come from the {p} government&rsquo;s own budget documents, each figure linked to the page it is printed on.</p>
          </li>
        ))}
      </ul>

      <div className="cp-note">
        <p>
          This site has not read any provincial budget yet, so no provincial figure is shown here and none is estimated. When they are added, each province&rsquo;s {c.lower} budget will be
          shown beside the others only where all four print the same kind of figure for the same year.
        </p>
        {lfs ? (
          <p>
            What this site does hold for each province: the Labour Force Survey&rsquo;s figures on work and jobs. <Link href="/topics/provinces">Figures by province</Link>
          </p>
        ) : null}
        {federal.length ? (
          <p>
            Federal {c.lower} spending is on the federal pages:{" "}
            {federal.map((s, i) => (
              <span key={s!.series_id}>
                {i ? ", " : ""}
                <Link href={seriesHref(s!.series_id)}>{seriesTitle(s!)}</Link>
              </span>
            ))}
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
