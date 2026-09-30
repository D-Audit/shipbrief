export function slugify(value: string, maxLength = 80) {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "update";
}

/** Returns `base`, or `base-2`, `base-3`… — the first candidate `isTaken` rejects. */
export async function uniqueSlug(base: string, isTaken: (candidate: string) => Promise<boolean>) {
  const root = slugify(base);
  if (!(await isTaken(root))) return root;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

/** Slugs that would collide with app routes or look official. */
export const RESERVED_WORKSPACE_SLUGS = new Set([
  "app", "api", "admin", "www", "shipbrief", "login", "signup", "static", "assets", "embed", "c", "help", "status", "docs",
]);
