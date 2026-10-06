import { beforeEach, describe, expect, it } from "vitest";
import { escapeXml, renderRss } from "../src/services/rss.service.js";
import { client, createRelease, memberOf, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

const publicGet = (url: string) => client().get(url);
const feedOf = (slug: string) => publicGet(`/api/public/workspaces/${slug}/rss.xml`);

/**
 * Minimal XML well-formedness check (no parser dependency): every tag closes in
 * order, attribute values are quoted, and text never holds a raw "<" or a bare "&".
 */
function assertWellFormedXml(xml: string) {
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  const body = xml.replace(/^<\?xml[^>]*\?>/, "");
  const stack: string[] = [];
  const token = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/gy;
  let consumed = 0;
  for (let match = token.exec(body); match; match = token.exec(body)) {
    consumed = token.lastIndex;
    const [, closing, name, , selfClosing, text] = match;
    if (text !== undefined) {
      expect(text).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
      continue;
    }
    if (closing) expect(stack.pop()).toBe(name);
    else if (!selfClosing) stack.push(name!);
  }
  expect(consumed).toBe(body.length);
  expect(stack).toEqual([]);
}

const items = (xml: string) => xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

describe("public changelog", () => {
  it("exists as soon as a workspace publishes, without the widget, and shows only changelog-published updates", async () => {
    const { client: c, slug } = await ownerWithWorkspace("pub");
    const workspace = await publicGet(`/api/public/workspaces/${slug}`);
    expect(workspace.status).toBe(200);
    expect(workspace.body.data).toMatchObject({ slug, url: `http://localhost:3000/c/${slug}`, rssUrl: `http://localhost:3000/c/${slug}/rss.xml`, settings: { allowSubscriptions: true, showAuthor: false } });

    const published = await createRelease(c, { title: "Public launch", channels: ["changelog"] });
    await publishRelease(c, published.id);
    await createRelease(c, { title: "Secret draft", channels: ["changelog"] });
    const inAppOnly = await createRelease(c, { title: "In-app only", channels: ["in_app"] });
    await publishRelease(c, inAppOnly.id);

    const list = await publicGet(`/api/public/workspaces/${slug}/releases`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((release: { title: string }) => release.title)).toEqual(["Public launch"]);
    expect(list.body.data[0]).not.toHaveProperty("author");
    expect((await publicGet(`/api/public/workspaces/${slug}/releases/${published.slug}`)).status).toBe(200);
    expect((await publicGet(`/api/public/workspaces/${slug}/releases/${inAppOnly.slug}`)).status).toBe(404);

    // The widget reads the same releases through its own channel.
    const key = (await c.get("/api/widget")).body.data.projectId as string;
    const widget = await publicGet(`/api/public/widget/${key}/updates`);
    expect(widget.body.data.items.map((item: { title: string }) => item.title)).toEqual(["In-app only"]);
    expect((await publicGet(`/api/public/widget/${key}`)).body.data.changelogUrl).toBe(`http://localhost:3000/c/${slug}`);
  });

  it("can be turned off: pages, feed and subscriptions disappear while the widget keeps working", async () => {
    const { client: c, slug } = await ownerWithWorkspace("off");
    const release = await createRelease(c, { channels: ["changelog", "in_app"] });
    await publishRelease(c, release.id);

    const settings = await c.patch("/api/changelog/settings", { enabled: false });
    expect(settings.status).toBe(200);
    expect(settings.body.data).toMatchObject({ enabled: false, allowSubscriptions: true });

    expect((await publicGet(`/api/public/workspaces/${slug}`)).status).toBe(404);
    expect((await publicGet(`/api/public/workspaces/${slug}/releases`)).status).toBe(404);
    expect((await publicGet(`/api/public/workspaces/${slug}/releases/${release.slug}`)).status).toBe(404);
    expect((await feedOf(slug)).status).toBe(404);
    const subscribe = await client().post(`/api/public/workspaces/${slug}/subscribe`, { email: "reader@customer.dev" });
    expect(subscribe.status).toBe(403);

    const key = (await c.get("/api/widget")).body.data.projectId as string;
    const widget = await publicGet(`/api/public/widget/${key}`);
    expect(widget.body.data.changelogUrl).toBeNull();
    expect((await publicGet(`/api/public/widget/${key}/updates`)).body.data.items).toHaveLength(1);
  });

  it("respects the subscription switch for changelog visitors only", async () => {
    const { client: c, slug } = await ownerWithWorkspace("subs");
    await c.patch("/api/changelog/settings", { allowSubscriptions: false });
    const refused = await client().post(`/api/public/workspaces/${slug}/subscribe`, { email: "reader@customer.dev" });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("SUBSCRIPTIONS_DISABLED");
    // The widget has its own switch (on by default).
    expect((await client().post(`/api/public/workspaces/${slug}/subscribe`, { email: "reader@customer.dev", source: "widget" })).status).toBe(202);
  });

  it("shows the publisher's name only when the workspace opts in", async () => {
    const { client: c, slug } = await ownerWithWorkspace("author");
    const release = await createRelease(c, { title: "Authored" });
    await publishRelease(c, release.id);
    expect((await feedOf(slug)).text).not.toContain("dc:creator>");

    await c.patch("/api/changelog/settings", { showAuthor: true });
    const list = await publicGet(`/api/public/workspaces/${slug}/releases`);
    expect(list.body.data[0].author).toEqual({ name: "Olivia Owner" });
    expect((await feedOf(slug)).text).toContain("<dc:creator>Olivia Owner</dc:creator>");
  });

  it("lets only admins and marketers change changelog settings", async () => {
    const { workspaceId } = await ownerWithWorkspace("perm");
    const viewer = await memberOf(workspaceId, "viewer");
    expect((await viewer.client.get("/api/changelog/settings")).status).toBe(200);
    expect((await viewer.client.patch("/api/changelog/settings", { enabled: false })).status).toBe(403);
    const marketer = await memberOf(workspaceId, "marketer");
    expect((await marketer.client.patch("/api/changelog/settings", { showAuthor: true })).status).toBe(200);
  });
});

describe("RSS feed", () => {
  it("is valid RSS 2.0 built from the same public releases, and never leaks drafts or another workspace's updates", async () => {
    const a = await ownerWithWorkspace("rss-a");
    const b = await ownerWithWorkspace("rss-b");
    const first = await createRelease(a.client, { title: "First <b>bold</b> & \"quoted\"", summary: "Tom's 5 < 6 summary", body: '<p>Body with <a href="https://example.org/?a=1&b=2">link</a></p>', tags: ["api"] });
    await publishRelease(a.client, first.id);
    const second = await createRelease(a.client, { title: "Second update" });
    await publishRelease(a.client, second.id);
    await createRelease(a.client, { title: "Unpublished draft" });
    const emailOnly = await createRelease(a.client, { title: "Email only", channels: ["email"] });
    await publishRelease(a.client, emailOnly.id);
    const other = await createRelease(b.client, { title: "Workspace B update" });
    await publishRelease(b.client, other.id);

    const res = await feedOf(a.slug);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/rss+xml; charset=utf-8");
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.headers.etag).toBeTruthy();
    const xml = res.text;
    assertWellFormedXml(xml);

    expect(xml).toContain("<title>Workspace rss-a changelog</title>");
    expect(xml).toContain(`<link>http://localhost:3000/c/${a.slug}</link>`);
    expect(xml).toContain(`<atom:link href="http://localhost:3000/c/${a.slug}/rss.xml" rel="self" type="application/rss+xml"/>`);

    const entries = items(xml);
    expect(entries).toHaveLength(2);
    // Newest first, with the public page as link and a stable, non-URL guid.
    expect(entries[0]).toContain("<title>Second update</title>");
    expect(entries[1]).toContain("<title>First &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;</title>");
    expect(entries[1]).toContain(`<link>http://localhost:3000/c/${a.slug}/${first.slug}</link>`);
    expect(entries[1]).toContain(`<guid isPermaLink="false">shipbrief:release:${first.id}</guid>`);
    expect(entries[1]).toContain("<description>Tom&apos;s 5 &lt; 6 summary</description>");
    expect(entries[1]).toContain("<category>api</category>");
    expect(entries[1]).toMatch(/<pubDate>\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/);
    // The body's HTML travels escaped inside content:encoded.
    expect(entries[1]).toContain("<content:encoded>&lt;p&gt;Body with &lt;a href=&quot;https://example.org/?a=1&amp;amp;b=2&quot;");

    expect(xml).not.toContain("Unpublished draft");
    expect(xml).not.toContain("Email only");
    expect(xml).not.toContain("Workspace B update");
    expect(items((await feedOf(b.slug)).text).join("")).not.toContain("Second update");
  });

  it("is 404 for unknown workspaces", async () => {
    expect((await feedOf("no-such-workspace-here")).status).toBe(404);
  });

  it("renders safely: escapes text, strips characters XML forbids, makes uploaded files absolute and drops unsafe markup", () => {
    expect(escapeXml(`a&b<c>"d"'e'\u0001￾`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;");
    const xml = renderRss(
      { title: "Acme & Co changelog", description: "Updates", url: "https://updates.acme.dev", feedUrl: "https://updates.acme.dev/rss.xml", imageUrl: "/api/files/ws/logo/a.png" },
      [
        {
          id: "r1",
          title: "Hello\u0000 world",
          url: "https://updates.acme.dev/hello",
          summary: "Summary",
          body: '<p>Hi</p><script>alert(1)</script><a href="/api/files/x.pdf">doc</a>',
          publishedAt: "2026-10-01T12:00:00.000Z",
          category: "Feature",
          tags: [],
          media: [{ id: "m1", type: "image", url: "/api/files/ws/media/shot.png", alt: 'A "shot"' }],
        },
      ],
    );
    assertWellFormedXml(xml);
    expect(xml).toContain("<title>Acme &amp; Co changelog</title>");
    expect(xml).toContain("<title>Hello world</title>");
    expect(xml).toContain("<url>http://localhost:3000/api/files/ws/logo/a.png</url>");
    expect(xml).toContain("<pubDate>Thu, 01 Oct 2026 12:00:00 GMT</pubDate>");
    expect(xml).not.toContain("&lt;script");
    expect(xml).not.toContain("alert(1)");
    expect(xml).toContain("href=&quot;http://localhost:3000/api/files/x.pdf&quot;");
    expect(xml).toContain("src=&quot;http://localhost:3000/api/files/ws/media/shot.png&quot; alt=&quot;A &amp;quot;shot&amp;quot;&quot;");
  });
});
