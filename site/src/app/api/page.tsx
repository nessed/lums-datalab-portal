// The API page. Behind the "api" flag (features.config.json); while it is off
// the page says so and points to what already works: every release file is a
// static download with a stable address.
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
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
          the whole release: <code><Num kind="id">{`${DATA_BASE}/all.csv`}</Num></code> (also <code>all.xlsx</code> and <code>all.zip</code>) and the other files listed on{" "}
          <Link href="/data">Download and file formats</Link>;
        </li>
        <li>
          one series: <code><Num kind="id">{`${DATA_BASE}/series/<series_id>.csv`}</Num></code> (one row per figure, status in its own column), <code>.xlsx</code>{" "}
          or <code>.zip</code> (a data package);
        </li>
        <li>
          the same files for whichever release is newest: <code>/data/latest/series/&lt;series_id&gt;.csv</code>, which a spreadsheet can load with{" "}
          <code>=IMPORTDATA()</code>;
        </li>
        <li>
          one figure with its evidence: <code><Num kind="id">{`${DATA_BASE}/receipts/<obs_id>.json`}</Num></code> (colons in the id written as <code>~</code>).
        </li>
      </ul>
      <p>
        The <code>/data/{"<release>"}/</code> addresses belong to release <Num kind="version">{RELEASE_VERSION}</Num> and never change; a later release gets its own
        folder, so a script written against one release keeps working. The <code>/data/latest/</code> addresses follow new releases.
      </p>
    </article>
  );
}
