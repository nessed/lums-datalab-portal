import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
import release from "./release.config.json";

// Release-pinned links (DESIGN.md 13.3): /<release>/o/<id>, /<release>/series/<id>
// and every other page are served by the same prerendered page as the latest
// address, so a pinned link costs no extra build. Only this build's release id
// is rewritten; any other /<release>/... is not a page and answers 404. When a
// later release ships, the build of this one stays deployed and the new build's
// rewrites send this id's prefix to it (see the Data page, "Links").
// /data/latest/... always serves the files of the release this build is from,
// so a script or =IMPORTDATA() line keeps working across releases.
// A static mirror needs the same rules in its server (one line each).
const v = release.version;

// In a git worktree whose node_modules is a junction to another checkout,
// Turbopack refuses a package outside its root; widen the root to the folder
// that holds both. Elsewhere (a normal checkout, Vercel) nothing changes.
function turbopackRoot(): string | undefined {
  const here = path.resolve(process.cwd());
  const nm = path.join(here, "node_modules");
  if (!fs.existsSync(nm)) return undefined;
  const real = fs.realpathSync(nm);
  if (real.startsWith(here + path.sep)) return undefined;
  const a = here.split(path.sep);
  const b = real.split(path.sep);
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return i > 0 ? a.slice(0, i).join(path.sep) + path.sep : undefined;
}
const root = turbopackRoot();

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    ...(root ? { root } : {}),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Data hub run (2026-11-23): Sources and Data types became the Library. The old
  // index addresses keep answering by redirect; /sources/<id> and /datasets/<id>
  // stay the permanent addresses of a document and a data type.
  async redirects() {
    return [
      { source: "/sources", destination: "/library", permanent: true },
      { source: "/datasets", destination: "/library/datasets", permanent: true },
      { source: `/${v}/sources`, destination: `/${v}/library`, permanent: true },
      { source: `/${v}/datasets`, destination: `/${v}/library/datasets`, permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: `/${v}`, destination: "/" },
      { source: `/${v}/:path*`, destination: "/:path*" },
      { source: "/data/latest/:path*", destination: `/data/${v}/:path*` },
    ];
  },
};

export default nextConfig;
