// The Library's file step (data hub plan, section 7.3). Run by
// scripts/prebuild.mjs after it has emptied public/data/<version>/.
//
// 1. pdf.js: copies the installed pdfjs-dist build into public/pdfjs/ (git-ignored)
//    so the document viewer can load it at run time, outside every page bundle.
// 2. Source files: for each source row of the release, puts a byte-for-byte copy
//    of the registered file in public/data/<version>/sources/<source_id>.<ext>,
//    trying in this order:
//      local    the folder named by SOURCES_DIR (layout <local_path>), read only;
//      cache    site/.cache/library/<sha256>.<ext> (git-ignored), filled by 3 and 4;
//      official the registered file_url;
//      archive  the Internet Archive copy, https://web.archive.org/web/<ts>id_/<url>.
//    A copy is kept only if its SHA-256 equals the release's sha256. A source whose
//    verification failed is never served. Network errors, time-outs and wrong bytes
//    skip that route and are logged; the build never fails because a site is down.
//    LIBRARY_FETCH=0 turns the network routes off.
// 3. Writes public/data/<version>/sources/index.json:
//      { files: [{ source_id, file, bytes, sha256, via }] }
//    read by src/lib/adapter/library.ts (readServedFiles) and by
//    scripts/checks/library-counts.mjs.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const UA = "LUMS-DataLab-Portal-site-build/0.1 (research project, LUMS Department of Economics; fetches each registered source document once per build)";
const TIMEOUT_MS = 60_000;
const MAX_BYTES = 80 * 1024 * 1024;

const sha256File = (p) =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(p)
      .on("data", (b) => h.update(b))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
const sha256Buf = (b) => crypto.createHash("sha256").update(b).digest("hex");

/** SOURCES_DIR from the environment, else the SOURCES_DIR line of the repository's .env (nothing else is read from it). */
function sourcesDir(siteDir) {
  if (process.env.SOURCES_DIR) return process.env.SOURCES_DIR;
  const env = path.resolve(siteDir, "..", ".env");
  if (!fs.existsSync(env)) return null;
  const m = /^\s*SOURCES_DIR\s*=\s*(.*?)\s*$/m.exec(fs.readFileSync(env, "utf8"));
  return m ? m[1].replace(/^["']|["']$/g, "") || null : null;
}

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/pdf,text/csv,*/*" }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`too large (${len} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`too large (${buf.length} bytes)`);
  return buf;
}

/** The raw-bytes form of the recorded Internet Archive copy. */
function archiveRaw(s) {
  if (s.wayback_url && /\/web\/\d+\//.test(s.wayback_url)) return s.wayback_url.replace(/\/web\/(\d+)\//, "/web/$1id_/");
  if (s.wayback_timestamp && s.file_url) return `https://web.archive.org/web/${s.wayback_timestamp}id_/${s.file_url}`;
  return null;
}

function copyPdfjs(siteDir) {
  let pkg;
  try {
    pkg = path.dirname(fs.realpathSync(path.join(siteDir, "node_modules", "pdfjs-dist", "package.json")));
  } catch {
    return "pdfjs-dist not installed; the viewer falls back to a plain link";
  }
  const out = path.join(siteDir, "public", "pdfjs");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of ["build/pdf.min.mjs", "build/pdf.worker.min.mjs", "web/pdf_viewer.mjs", "web/pdf_viewer.css", "LICENSE"]) {
    if (fs.existsSync(path.join(pkg, f))) fs.copyFileSync(path.join(pkg, f), path.join(out, path.basename(f)));
  }
  for (const d of ["web/images", "standard_fonts", "cmaps", "wasm", "iccs"]) {
    if (fs.existsSync(path.join(pkg, d))) fs.cpSync(path.join(pkg, d), path.join(out, path.basename(d)), { recursive: true });
  }
  const v = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version;
  return `pdf.js ${v}`;
}

export default async function library(ctx) {
  const { siteDir, dest, sources } = ctx;
  const pdfjs = copyPdfjs(siteDir);

  const outDir = path.join(dest, "sources");
  const cacheDir = path.join(siteDir, ".cache", "library");
  fs.mkdirSync(outDir, { recursive: true });
  const localDir = sourcesDir(siteDir);
  const network = process.env.LIBRARY_FETCH !== "0";
  const files = [];
  const log = [];

  for (const s of sources) {
    const id = s.source_id;
    if (s.verification_status === "failed") {
      log.push(`${id}: rejected source, not served`);
      continue;
    }
    if (!s.sha256) {
      log.push(`${id}: no fingerprint in the release, not served`);
      continue;
    }
    const ext = (path.extname(s.local_path ?? s.file_url ?? "").toLowerCase() || `.${s.format ?? "pdf"}`).replace(/[^.a-z0-9]/g, "");
    const file = `${id}${ext}`;
    const target = path.join(outDir, file);
    const cached = path.join(cacheDir, `${s.sha256}${ext}`);
    let via = null;

    // 1. the local sources folder (read only: only ever read and copied from)
    if (localDir && s.local_path) {
      const p = path.join(localDir, ...s.local_path.split("/"));
      if (fs.existsSync(p)) {
        const h = await sha256File(p);
        if (h === s.sha256) {
          fs.copyFileSync(p, target);
          via = "local";
        } else log.push(`${id}: local file has a different fingerprint, not used`);
      }
    }
    // 2. the build cache
    if (!via && fs.existsSync(cached)) {
      if ((await sha256File(cached)) === s.sha256) {
        fs.copyFileSync(cached, target);
        via = "cache";
      } else {
        fs.rmSync(cached, { force: true });
        log.push(`${id}: cached copy had a different fingerprint, removed`);
      }
    }
    // 3 and 4. the official address, then the Internet Archive copy
    const routes = network ? [["official", s.file_url], ["archive", archiveRaw(s)]] : [];
    for (const [name, url] of routes) {
      if (via || !url) continue;
      try {
        const buf = await download(url);
        const h = sha256Buf(buf);
        if (h !== s.sha256) {
          log.push(`${id}: ${name} copy has a different fingerprint (${buf.length} bytes), dropped`);
          continue;
        }
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cached, buf);
        fs.writeFileSync(target, buf);
        via = name;
      } catch (e) {
        log.push(`${id}: ${name} address failed (${e?.name === "TimeoutError" ? "timed out" : (e?.message ?? e)}), skipped`);
      }
    }
    if (!via) {
      log.push(`${id}: no verified copy; the document shows its official link only`);
      continue;
    }
    files.push({ source_id: id, file, bytes: fs.statSync(target).size, sha256: s.sha256, via });
  }

  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ release: ctx.version, files }, null, 1));
  for (const l of log) console.log(`prebuild: library: ${l}`);
  const by = files.reduce((a, f) => ({ ...a, [f.via]: (a[f.via] ?? 0) + 1 }), {});
  const how = Object.entries(by)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return `${pdfjs}; ${files.length} of ${sources.length} source files served (${how || "none"})${localDir ? "" : "; SOURCES_DIR not set"}`;
}
