// The API page. Behind the "api" flag (features.config.json); while it is off
// the page says so and points to what already works: every release file is a
// static download with a stable address.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Basics";
import { Num } from "@/components/ui/Num";
import { DATA_BASE, RELEASE_VERSION } from "@/lib/data";
import { COMING, feature } from "@/lib/features";

export const metadata: Metadata = { title: "API", description: "A documented API for the portal is planned. Until then every release file is a static download." };

export default function ApiPage() {
  const f = feature("api");
  return (
    <article className="is-prose prose">
      <Breadcrumbs items={[{ label: "API" }]} />
      <h1>{f.label}</h1>
      <p className="coming-block">{COMING}.</p>
      <p>
        A documented query API is planned. Until it exists, everything the site shows is already available as static files with stable addresses, one
        folder per release:
      </p>
      <ul>
        <li>
          the whole release: <code><Num kind="id">{`${DATA_BASE}/observations.csv`}</Num></code> and the other files listed on{" "}
          <Link href="/data">Download and file formats</Link>;
        </li>
        <li>
          one series: <code><Num kind="id">{`${DATA_BASE}/series/<series_id>.json`}</Num></code> or <code>.csv</code>;
        </li>
        <li>
          one figure with its evidence: <code><Num kind="id">{`${DATA_BASE}/receipts/<obs_id>.json`}</Num></code> (colons in the id written as <code>~</code>).
        </li>
      </ul>
      <p>
        These addresses belong to release <Num kind="version">{RELEASE_VERSION}</Num>. A later release gets its own folder, so a script written against
        one release keeps working.
      </p>
    </article>
  );
}
