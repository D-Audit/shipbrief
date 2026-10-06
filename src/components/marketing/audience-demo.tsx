import { ArrowRight } from "lucide-react";

const sources = [
  { label: "Signed in to your product", detail: "Added by the widget, kept up to date" },
  { label: "Subscribe forms", detail: "Widget and changelog, after they confirm" },
  { label: "Your server", detail: "REST API, or a CSV import" },
];

const contacts = [
  { email: "maya@acme.com", plan: "Pro", source: "Widget", subscribed: true },
  { email: "lee@northwind.io", plan: "Pro", source: "API", subscribed: true },
  { email: "sam@globex.dev", plan: "Free", source: "Changelog", subscribed: true },
  { email: "ana@initech.com", plan: "Pro", source: "Import", subscribed: false },
];

/** Static illustration: where contacts come from, and who a release email reaches. */
export function AudienceDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.3fr)] lg:items-center">
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.label} className="rounded-lg border border-border bg-card px-3.5 py-3">
            <p className="text-sm font-medium">{source.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{source.detail}</p>
          </li>
        ))}
      </ul>

      <ArrowRight className="mx-auto hidden size-4 text-muted-foreground lg:block" aria-hidden="true" />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold">Contacts</p>
          <p className="text-[11px] text-muted-foreground">Audience: <span className="font-medium text-foreground">Pro customers</span></p>
        </div>
        <ul className="divide-y divide-border">
          {contacts.map((contact) => {
            const reached = contact.subscribed && contact.plan === "Pro";
            return (
              <li key={contact.email} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{contact.email}</span>
                  <span className="block text-[11px] text-muted-foreground">{contact.plan} plan · via {contact.source}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground/80">
                  <span className={reached ? "size-1.5 rounded-full bg-foreground" : "size-1.5 rounded-full border border-border-strong"} />
                  {reached ? "Gets the email" : contact.subscribed ? "Not in audience" : "Unsubscribed"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
