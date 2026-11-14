/** URL-safe slug for ids. Colons (in observation ids) are not safe in file
 * names on Windows, so ":" becomes "~". Must match scripts/prebuild.mjs. */
export function slugify(id: string): string {
  return id.replaceAll(":", "~").replace(/[^A-Za-z0-9._~-]/g, "_");
}
