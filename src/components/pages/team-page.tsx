"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { useAsyncData } from "@/hooks/use-async-data";
import { activityService, teamService } from "@/lib/services";
import type { TeamMember, TeamRole } from "@/types";

const roles: { value: TeamRole; label: string; detail: string }[] = [
  { value: "owner", label: "Owner", detail: "Full workspace control" },
  { value: "admin", label: "Admin", detail: "Manage workspace and publishing" },
  { value: "product_manager", label: "Product Manager", detail: "Review roadmap and approvals" },
  { value: "marketer", label: "Marketer", detail: "Create and schedule communication" },
  { value: "developer", label: "Developer", detail: "Provide source context and drafts" },
  { value: "viewer", label: "Viewer", detail: "View shared workspace information" },
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
      toast.success(member.name + " role updated (mock).");
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
      toast.success(removeTarget.name + " was removed (mock).");
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
      <PageHeader title="Team" description="Set clear permissions and keep approval ownership visible." actions={<Button type="button" onClick={() => setInviteOpen(true)}><UserPlus />Invite member</Button>} />
      <section className="rounded-xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span><div><h2 className="text-sm font-semibold">Release approval flow</h2><p className="mt-1 text-sm text-muted-foreground">Draft → In review → Approved → Scheduled → Published. Publishing stays explicit and can be traced to a teammate.</p></div></div></section>
      <section className="space-y-3"><div><h2 className="text-base font-semibold">People</h2><p className="text-sm text-muted-foreground">{state.data.length} workspace members</p></div>{state.data.length === 0 ? <EmptyState title="Your team is empty" description="Invite a teammate to start review and publishing workflows." action={<Button type="button" onClick={() => setInviteOpen(true)}><Plus />Invite member</Button>} /> : <div className="space-y-2">{state.data.map((member) => <TeamMemberRow key={member.id} member={member} busy={busyId === member.id} onRoleChange={(role) => void updateRole(member, role)} onRemove={() => setRemoveTarget(member)} />)}</div>}</section>
      <section className="sb-panel p-4"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /><div><h2 className="text-base font-semibold">Recent approval history</h2><p className="text-xs text-muted-foreground">Named human actions from the workspace activity stream.</p></div></div>{activityState.status === "loading" && <LoadingState rows={1} />}{activityState.status === "success" && <div className="mt-4 space-y-3">{approvalEvents.length ? approvalEvents.map((event) => <div key={event.id} className="flex items-start gap-3 text-sm"><span className="mt-1 size-1.5 rounded-full bg-success" /><div><p>{event.message}</p><p className="text-xs text-muted-foreground">{event.actor ?? "Workspace member"}</p></div></div>) : <p className="text-sm text-muted-foreground">Approvals will appear here as teammates review releases.</p>}</div>}</section>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={async (input) => { try { await teamService.invite(input); await reload(); toast.success("Invitation created (mock)."); } catch { toast.error("We could not invite that teammate."); } }} />
      {removeTarget && <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}><DialogContent><DialogHeader><DialogTitle>Remove {removeTarget.name}?</DialogTitle><DialogDescription>This immediately removes their mock workspace access. The real backend will enforce sessions and access controls later.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button><Button type="button" variant="destructive" onClick={() => void remove()} disabled={busyId === removeTarget.id}>{busyId === removeTarget.id && <Loader2 className="animate-spin" />}Remove member</Button></DialogFooter></DialogContent></Dialog>}
    </div>
  );
}

function TeamMemberRow({ member, busy, onRoleChange, onRemove }: { member: TeamMember; busy: boolean; onRoleChange: (role: TeamRole) => void; onRemove: () => void }) {
  const initials = member.name.split(" ").map((part) => part[0]).join("");
  return <article className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><Avatar><AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback></Avatar><div className="min-w-0"><h3 className="truncate font-medium">{member.name}</h3><p className="truncate text-sm text-muted-foreground">{member.email}</p></div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={member.status} />{member.role === "owner" ? <span className="rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground">Owner</span> : <Select value={member.role} onValueChange={(value) => value && onRoleChange(value as TeamRole)}><SelectTrigger className="w-40" disabled={busy}><SelectValue>{(value) => roles.find((role) => role.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{roles.filter((role) => role.value !== "owner").map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select>} {member.role !== "owner" && <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} disabled={busy} aria-label={"Remove " + member.name}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button>}</div></article>;
}

function InviteDialog({ open, onOpenChange, onInvite }: { open: boolean; onOpenChange: (open: boolean) => void; onInvite: (input: Pick<TeamMember, "name" | "email" | "role">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("marketer");
  const [pending, setPending] = useState(false);
  const invite = async () => { if (!name.trim() || !email.trim() || pending) return; setPending(true); try { await onInvite({ name: name.trim(), email: email.trim(), role }); setName(""); setEmail(""); setRole("marketer"); onOpenChange(false); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Invite teammate</DialogTitle><DialogDescription>Invite a collaborator into the review, planning, and publishing workflow. Invitations are mocked in this frontend phase.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Maya Patel" /></div><div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="maya@acme.com" /></div><div className="space-y-2"><Label htmlFor="invite-role">Role</Label><Select value={role} onValueChange={(value) => value && setRole(value as TeamRole)}><SelectTrigger id="invite-role" className="w-full"><SelectValue>{(value) => roles.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{roles.filter((item) => item.value !== "owner").map((item) => <SelectItem key={item.value} value={item.value}>{item.label} · {item.detail}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void invite()} disabled={!name.trim() || !email.trim() || pending}>{pending && <Loader2 className="animate-spin" />}Send invite</Button></DialogFooter></DialogContent></Dialog>;
}
