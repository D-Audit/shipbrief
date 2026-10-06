/**
 * RSS feed of a public changelog: /c/[workspace]/rss.xml, and /rss.xml on a
 * verified custom domain (the proxy rewrites it here). The API builds the feed
 * from the same published releases the changelog page shows.
 */

const apiBase = () => (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");

export async function GET(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(workspace)) return new Response("Not found", { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase()}/api/public/workspaces/${workspace}/rss.xml`, {
      // An explicit Cache-Control stops fetch adding "no-cache" (for no-store), which would disable the API's 304s.
      headers: { Accept: "application/rss+xml", "Cache-Control": "max-age=0", ...(request.headers.get("if-none-match") ? { "If-None-Match": request.headers.get("if-none-match")! } : {}) },
      cache: "no-store",
    });
  } catch {
    return new Response("Feed temporarily unavailable", { status: 503, headers: { "Retry-After": "60" } });
  }

  if (upstream.status === 304) return new Response(null, { status: 304, headers: { ETag: upstream.headers.get("etag") ?? "" } });
  if (!upstream.ok) {
    return new Response(upstream.status === 404 ? "Not found" : "Feed temporarily unavailable", {
      status: upstream.status === 404 ? 404 : 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const headers = new Headers({
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": upstream.headers.get("cache-control") ?? "public, max-age=300",
  });
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  return new Response(await upstream.text(), { status: 200, headers });
}
