/** Public changelog dates render on the server and in the browser; formatting in UTC keeps both identical. */
const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export const formatPublicDate = (iso: string) => longDate.format(new Date(iso));

/** Link to an update: "/c/acme/my-update" on ShipBrief, "/my-update" on a custom domain (basePath ""). */
export const releaseHref = (basePath: string, slug: string) => `${basePath}/${slug}`;

export const changelogHome = (basePath: string) => basePath || "/";
