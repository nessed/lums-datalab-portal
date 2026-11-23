// Guides (2026-11-23, Guide design): a short index. Written guides link to their
// page; the ones being written are named without a link. No figures here.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { GUIDES, GUIDES_COMING, guideHref } from "@/components/pages/guides";

export const metadata: Metadata = {
  title: "Guides",
  description: "Short explainers of how to read Pakistan's official figures: what a revised estimate is, and more being written.",
};

export default function GuidesPage() {
  return (
    <div className="pg gd-index">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Guides" }]} />
      <h1 className="pg-h1">Guides</h1>
      <p className="pg-lede">Short explainers of how to read the figures on this site: what each kind of figure means and why some are never compared.</p>
      <section className="pg-sec" aria-labelledby="gd-written-h">
        <h2 id="gd-written-h" className="pg-h2">
          Written
        </h2>
        <ul className="gd-list">
          {GUIDES.map((g) => (
            <li key={g.slug} className="gd-item">
              <span className="gd-section">{g.section}</span>
              <Link href={guideHref(g.slug)} className="gd-title">
                {g.title}
              </Link>
              <span className="gd-sum">{g.summary}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="pg-sec" aria-labelledby="gd-coming-h">
        <h2 id="gd-coming-h" className="pg-h2">
          Being written
        </h2>
        <ul className="gd-list gd-coming">
          {GUIDES_COMING.map((t) => (
            <li key={t} className="gd-item">
              <span className="gd-title-off">{t}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
