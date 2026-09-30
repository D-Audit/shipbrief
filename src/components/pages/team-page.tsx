"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader, StatusBadge } from "@/components/shared/page-states";
import { toneFill, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useAsyncData } from "@/hooks/use-async-data";
import { activityService, teamService } from "@/lib/services";
import type { TeamMember, TeamRole } from "@/types";

const roles: { value: TeamRole; label: string; detail: string; tone: Tone }[] = [
  { value: "owner", label: "Owner", detail: "Full workspace control", tone: "ink" },
  { value: "admin", label: "Admin", detail: "Manage workspace and publishing", tone: "violet" },
  { value: "product_manager", label: "Product Manager", detail: "Review roadmap and approvals", tone: "blue" },
  { value: "marketer", label: "Marketer", detail: "Create and schedule communication", tone: "rose" },
  { value: "developer", label: "Developer", detail: "Provide source context and drafts", tone: "green" },
  { value: "viewer", label: "Viewer", detail: "View shared workspace information", tone: "neutral" },
];


export function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { state, reload } = useAsyncData(() => teamService.list(), []);
  const { state: activityState } = useAsyncData(() => activityService.list(), []);

  const updateRole = async (member: TeamMember, role: TeamRole) => {
    setBusyId(member.id);
    try {
      await teamService.updateRole(member.id, role);
      await reload();
      toast.success(member.name + " role updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not update the role.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    setBusyId(removeTarget.id);
    try {
      await teamService.remove(removeTarget.id);
      await reload();
      toast.success(removeTarget.name + " was removed.");
      setRemoveTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not remove this member.");
    } finally {
      setBusyId(null);
    }
  };

  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;

  const approvalEvents = activityState.status === "success" ? activityState.data.filter((event) => event.type === "approved" || event.type === "published").slice(0, 3) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Who can write, review and publish. Every release is approved by a named teammate." actions={<Button type="button" onClick={() => setInviteOpen(true)}><UserPlus />Invite member</Button>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="sb-panel min-w-0 p-5" aria-labelledby="people-heading">
          <SectionHeader id="people-heading" title="People" description={`${state.data.length} workspace member${state.data.length === 1 ? "" : "s"}`} />
          {state.data.length === 0 ? (
            <EmptyState className="mt-4" title="Your team is empty" description="Invite a teammate to start review and publishing workflows." action={<Button type="button" onClick={() => setInviteOpen(true)}><Plus />Invite member</Button>} />
          ) : (
            <div className="mt-3 divide-y divide-border">
              {state.data.map((member) => <TeamMemberRow key={member.id} member={member} busy={busyId === member.id} onRoleChange={(role) => void updateRole(member, role)} onRemove={() => setRemoveTarget(member)} />)}
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-5">
          <section className="sb-panel p-5" aria-labelledby="roles-heading">
            <SectionHeader id="roles-heading" title="Roles" description="Who can do what." />
            <ul className="mt-4 space-y-2.5">
              {roles.filter((role) => role.value !== "viewer" || state.data.some((member) => member.role === "viewer")).map((role) => {
                const count = state.data.filter((member) => member.role === role.value).length;
                return (
                  <li key={role.value} className="flex items-center gap-3">
                    <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", toneFill[role.tone])} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{role.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{role.detail}</span>
                    </span>
                    <span className="sb-numeric text-sm text-muted-foreground">{count}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-[var(--radius-xl)] sb-feature p-5" aria-labelledby="approvals-heading">
            <div className="flex items-center justify-between">
              <h2 id="approvals-heading" className="sb-title-section text-ink-foreground">Approval trail</h2>
              <CheckCircle2 className="size-4 text-ink-foreground/50" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-ink-foreground/60">Every publish is traced to a named teammate.</p>
            {activityState.status === "loading" && <p className="mt-4 text-sm text-ink-foreground/60">Loading…</p>}
            {activityState.status === "success" && (
              <ol className="mt-4 space-y-3">
                {approvalEvents.length ? approvalEvents.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 rounded-lg bg-ink-foreground/[0.07] px-3 py-2.5 text-sm">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", event.type === "published" ? "bg-primary-strong" : "bg-ink-foreground/50")} />
                    <span className="min-w-0">
                      <span className="block">{event.message}</span>
                      <span className="block text-xs text-ink-foreground/60">{event.actor ?? "Workspace member"}</span>
                    </span>
                  </li>
                )) : <li className="text-sm text-ink-foreground/60">Approvals will appear here as teammates review releases.</li>}
              </ol>
            )}
          </section>
        </aside>
      </div>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={async (input) => { try { await teamService.invite(input); await reload(); toast.success("Invitation created."); } catch { toast.error("We could not invite that teammate."); } }} />
      {removeTarget && <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}><DialogContent><DialogHeader><DialogTitle>Remove {removeTarget.name}?</DialogTitle><DialogDescription>This immediately removes their access to the workspace on every device.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button><Button type="button" variant="destructive" onClick={() => void remove()} disabled={busyId === removeTarget.id}>{busyId === removeTarget.id && <Loader2 className="animate-spin" />}Remove member</Button></DialogFooter></DialogContent></Dialog>}
    </div>
  );
}

function TeamMemberRow({ member, busy, onRoleChange, onRemove }: { member: TeamMember; busy: boolean; onRoleChange: (role: TeamRole) => void; onRemove: () => void }) {
  const initials = member.name.split(" ").map((part) => part[0]).join("");
  return <article className="flex flex-col gap-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><Avatar><AvatarFallback className="bg-surface-subtle font-medium text-foreground/80">{initials}</AvatarFallback></Avatar><div className="min-w-0"><h3 className="truncate font-medium">{member.name}</h3><p className="truncate text-sm text-muted-foreground">{member.email}</p></div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={member.status} />{member.role === "owner" ? <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-ink-foreground">Owner</span> : <Select value={member.role} onValueChange={(value) => value && onRoleChange(value as TeamRole)}><SelectTrigger className="w-40" disabled={busy}><SelectValue>{(value) => roles.find((role) => role.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{roles.filter((role) => role.value !== "owner").map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select>} {member.role !== "owner" && <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} disabled={busy} aria-label={"Remove " + member.name}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button>}</div></article>;
}

function InviteDialog({ open, onOpenChange, onInvite }: { open: boolean; onOpenChange: (open: boolean) => void; onInvite: (input: Pick<TeamMember, "name" | "email" | "role">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("marketer");
  const [pending, setPending] = useState(false);
  const invite = async () => { if (!name.trim() || !email.trim() || pending) return; setPending(true); try { await onInvite({ name: name.trim(), email: email.trim(), role }); setName(""); setEmail(""); setRole("marketer"); onOpenChange(false); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Invite teammate</DialogTitle><DialogDescription>Invite a collaborator into the review, planning, and publishing workflow. They&apos;ll get an email and join as soon as they sign in with that address.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Maya Patel" /></div><div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="maya@acme.com" /></div><div className="space-y-2"><Label htmlFor="invite-role">Role</Label><Select value={role} onValueChange={(value) => value && setRole(value as TeamRole)}><SelectTrigger id="invite-role" className="w-full"><SelectValue>{(value) => roles.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{roles.filter((item) => item.value !== "owner").map((item) => <SelectItem key={item.value} value={item.value}>{item.label} · {item.detail}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void invite()} disabled={!name.trim() || !email.trim() || pending}>{pending && <Loader2 className="animate-spin" />}Send invite</Button></DialogFooter></DialogContent></Dialog>;
}
