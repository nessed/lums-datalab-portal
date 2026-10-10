"use client";
// Chooses between two views that were both rendered on the server and passed
// in as props. The choice lives in the URL (?view=share). No data is fetched.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Labels = { nominal: string; share: string };

export function ViewTabs({ active, labels, path }: { active: "nominal" | "share"; labels: Labels; path: string }) {
  return (
    <nav className="tabs" aria-label="Choose how the series is shown">
      <Link href={path} scroll={false} aria-current={active === "nominal" ? "true" : undefined} className="tab">
        {labels.nominal}
      </Link>
      <Link href={`${path}?view=share`} scroll={false} aria-current={active === "share" ? "true" : undefined} className="tab">
        {labels.share}
      </Link>
    </nav>
  );
}

export default function ViewSwitch({ nominal, share, labels }: { nominal: ReactNode; share: ReactNode; labels: Labels }) {
  const params = useSearchParams();
  const path = usePathname();
  const active = params.get("view") === "share" ? "share" : "nominal";
  return (
    <>
      <ViewTabs active={active} labels={labels} path={path} />
      {active === "share" ? share : nominal}
    </>
  );
}
