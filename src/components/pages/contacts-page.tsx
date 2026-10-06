"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileUp, Loader2, Plug, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { useSession } from "@/components/session/session-provider";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { contactService } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { Contact, ContactImportResult, ContactStatusFilter } from "@/types";

const PAGE_SIZE = 50;
const filters: { value: ContactStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "subscribed", label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

const CONTACT_SOURCE_LABELS: Record<NonNullable<Contact["source"]>, string> = {
  manual: "added by hand",
  import: "CSV import",
  api: "API",
  changelog: "changelog subscribe",
  widget: "widget",
};

/** The people who receive release emails: added by hand, imported from CSV, subscribed on the changelog, or sent through the API. */
export function ContactsPage() {
  const { session } = useSession();
  const changelogPath = `/c/${session.workspace?.slug ?? ""}`;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContactStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { state, reload } = useAsyncData(() => contactService.list({ search: search || undefined, status, page, pageSize: PAGE_SIZE }), [search, status, page]);

  const remove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await contactService.remove(removeTarget.id);
      toast.success(`${removeTarget.email} removed.`);
      setRemoveTarget(null);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not remove that contact.");
    } finally {
      setRemoving(false);
    }
  };

  const data = state.status === "success" ? state.data : null;
  const noContactsAtAll = data?.counts.total === 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="The people who get your release emails. Anyone who unsubscribes is never emailed again."
        actions={
          <>
            <ButtonLink href="/app/api/guide" variant="ghost"><Plug />Connect your app</ButtonLink>
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}><FileUp />Import CSV</Button>
            <Button type="button" onClick={() => setAddOpen(true)}><UserPlus />Add contact</Button>
          </>
        }
      />

      {data && (
        <section aria-label="Contact summary" className="grid grid-cols-3 gap-3">
          {[
            { label: "Contacts", value: data.counts.total },
            { label: "Subscribed", value: data.counts.subscribed },
            { label: "Unsubscribed", value: data.counts.unsubscribed },
          ].map((stat) => (
            <div key={stat.label} className="sb-panel p-4">
              <p className="sb-stat text-[1.625rem]">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </section>
      )}

      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
      {(state.status === "loading" || state.status === "idle") && <LoadingState rows={5} />}

      {data && noContactsAtAll && (
        <EmptyState
          title="No contacts yet"
          description="Add people by hand, import a CSV from your CRM or spreadsheet, connect your app so new sign-ups are added automatically, or let customers subscribe themselves from your public changelog."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => setAddOpen(true)}><UserPlus />Add contact</Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}><FileUp />Import CSV</Button>
              <ButtonLink href={changelogPath} target="_blank" variant="ghost">Open changelog</ButtonLink>
            </div>
          }
        />
      )}

      {data && !noContactsAtAll && (
        <section className="sb-panel min-w-0 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search email or name" aria-label="Search contacts" className="h-9 pl-8" />
            </div>
            <div role="radiogroup" aria-label="Show" className="inline-flex w-fit rounded-lg bg-surface-subtle p-1">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  role="radio"
                  aria-checked={status === filter.value}
                  onClick={() => {
                    setStatus(filter.value);
                    setPage(1);
                  }}
                  className={cn("h-7 rounded-md px-3 text-[13px] font-medium transition-colors", status === filter.value ? "bg-surface text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No contacts match.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {data.items.map((contact) => (
                <li key={contact.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{contact.email ?? contact.externalId}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[contact.name, contact.plan && `${contact.plan} plan`, contact.tags.length ? contact.tags.join(", ") : null, contact.source && `via ${CONTACT_SOURCE_LABELS[contact.source]}`, contact.lastSeenAt ? `last seen ${format(new Date(contact.lastSeenAt), "MMM d, yyyy")}` : `added ${format(new Date(contact.createdAt), "MMM d, yyyy")}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {contact.email ? <StatusBadge status={contact.subscribed ? "subscribed" : "unsubscribed"} /> : <span className="text-xs text-muted-foreground" title="Identified in the widget without an email, so release emails can't reach them.">No email</span>}
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setRemoveTarget(contact)} aria-label={`Remove ${contact.email ?? "contact"}`}><Trash2 /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          )}
        </section>
      )}

      {data && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Customers can also subscribe themselves with the &ldquo;Get updates by email&rdquo; box on your <Link href={changelogPath} target="_blank" className="font-medium text-foreground underline-offset-4 hover:underline">public changelog</Link>. They confirm by email first and are tagged <span className="font-medium text-foreground">changelog</span>. Developers can add contacts automatically through the <Link href="/app/api" className="font-medium text-foreground underline-offset-4 hover:underline">API</Link>.
        </p>
      )}

      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => void reload()} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void reload()} />
      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.email}?</DialogTitle>
            <DialogDescription>They won&apos;t get any more release emails. To stop emailing someone but keep the record, ask them to use the unsubscribe link instead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => void remove()} disabled={removing}>{removing && <Loader2 className="animate-spin" />}Remove contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddContactDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("");
  const [tags, setTags] = useState("");
  const [pending, setPending] = useState(false);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setEmail("");
      setName("");
      setPlan("");
      setTags("");
    }
  };

  const add = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const contact = await contactService.add({
        email: email.trim(),
        name: name.trim() || undefined,
        plan: plan.trim() || undefined,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      toast.success(`${contact.email} added.`);
      onAdded();
      close(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not add that contact.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={(event) => void add(event)}>
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
            <DialogDescription>Only add people who expect to hear from you, such as your customers. Every email includes an unsubscribe link.</DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-4">
            <div className="space-y-2"><Label htmlFor="contact-email">Email</Label><Input id="contact-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="maya@customer.com" autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="contact-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Maya Patel" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="contact-plan">Plan <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="contact-plan" value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="pro" /></div>
              <div className="space-y-2"><Label htmlFor="contact-tags">Tags <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="contact-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="beta, vip" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Plan and tags let you send an email to only some contacts, using audiences.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={!email.trim() || pending}>{pending && <Loader2 className="animate-spin" />}Add contact</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setCsv("");
      setFileName("");
      setResult(null);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 900_000) {
      toast.error("That file is too large. Split it into files under 900 KB.");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
    setResult(null);
  };

  const runImport = async () => {
    setPending(true);
    try {
      const imported = await contactService.importCsv(csv);
      setResult(imported);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not import that file.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV with an <span className="font-medium text-foreground">email</span> column. Optional columns: <span className="font-medium text-foreground">name</span>, <span className="font-medium text-foreground">plan</span>, <span className="font-medium text-foreground">tags</span> (separate several with |). Up to 5,000 rows at a time.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm" aria-live="polite">
            <p className="font-medium text-foreground">
              {result.added.toLocaleString()} added, {result.updated.toLocaleString()} updated{result.skippedCount ? `, ${result.skippedCount.toLocaleString()} skipped` : ""}.
            </p>
            {result.skippedCount > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-xs text-muted-foreground">
                {result.skipped.map((skip) => <li key={skip.row}>Row {skip.row}: {skip.reason}</li>)}
                {result.skippedCount > result.skipped.length && <li>…and {result.skippedCount - result.skipped.length} more</li>}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">People who unsubscribed before stay unsubscribed, even if they&apos;re in the file.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
            <Button type="button" variant="outline" className="w-full" onClick={() => fileInput.current?.click()}><FileUp />{fileName || "Choose a CSV file"}</Button>
            <div className="space-y-2">
              <Label htmlFor="import-csv" className="text-xs text-muted-foreground">Or paste rows here</Label>
              <Textarea id="import-csv" value={csv} onChange={(event) => { setCsv(event.target.value); setFileName(""); }} rows={6} placeholder={"email,name,plan,tags\nmaya@customer.com,Maya Patel,pro,beta|vip"} className="font-mono text-xs" />
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="button" onClick={() => void runImport()} disabled={!csv.trim() || pending}>{pending && <Loader2 className="animate-spin" />}Import</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
