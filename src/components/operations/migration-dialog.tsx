"use client";

import { useState } from "react";
import { CheckCircle2, FileArchive, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { migrationService } from "@/lib/services";
import type { MigrationPreview, MigrationResult, MigrationSource } from "@/types";

const sources: { value: MigrationSource; label: string }[] = [
  { value: "headway", label: "Headway" },
  { value: "featurebase", label: "Featurebase" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "other", label: "Other export" },
];

export function MigrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [source, setSource] = useState<MigrationSource>("headway");
  const [fileName, setFileName] = useState("");
  const [preserveDates, setPreserveDates] = useState(true);
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [pending, setPending] = useState<"preview" | "import" | null>(null);

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setPreview(null);
      setResult(null);
      setPending(null);
    }
  };

  const requestPreview = async () => {
    setPending("preview");
    try {
      setPreview(await migrationService.preview({ source, fileName: fileName || undefined }));
      setResult(null);
    } catch {
      toast.error("We could not preview this migration.");
    } finally {
      setPending(null);
    }
  };

  const stageImport = async () => {
    setPending("import");
    try {
      const nextResult = await migrationService.stageImport({ source, fileName: fileName || undefined, preserveDates, preserveFormatting });
      setResult(nextResult);
      toast.success(`${nextResult.imported} posts staged for import (mock). Existing updates are unchanged.`);
    } catch {
      toast.error("We could not stage this migration.");
    } finally {
      setPending(null);
    }
  };

  const updateSource = (value: string | null) => {
    if (!value) return;
    setSource(value as MigrationSource);
    setPreview(null);
    setResult(null);
  };

  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Import & migration</DialogTitle><DialogDescription>Preview an export before any future backend import. This frontend flow stages a mock result and never overwrites existing updates.</DialogDescription></DialogHeader><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="migration-source">Import source</Label><Select value={source} onValueChange={updateSource}><SelectTrigger id="migration-source" className="w-full"><SelectValue>{(value) => sources.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{sources.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="migration-file">Export file <span className="text-muted-foreground">(optional)</span></Label><Input id="migration-file" type="file" accept=".csv,.json,.zip" onChange={(event) => { setFileName(event.target.files?.[0]?.name ?? ""); setPreview(null); setResult(null); }} /></div></div><div className="rounded-lg border border-border bg-surface-subtle/60 p-3 text-xs leading-relaxed text-muted-foreground"><FileArchive className="mr-1 inline size-3.5 text-primary" />{fileName ? `${fileName} is held only in this local preview.` : "Choose an export when one is available; no file is uploaded in this frontend phase."}</div><div className="space-y-3"><label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={preserveDates} onChange={(event) => setPreserveDates(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="font-medium">Preserve original dates</span><span className="mt-0.5 block text-xs text-muted-foreground">Keep historical publishing dates wherever the source provides them.</span></span></label><label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={preserveFormatting} onChange={(event) => setPreserveFormatting(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="font-medium">Preserve formatting and media references</span><span className="mt-0.5 block text-xs text-muted-foreground">Map formatting and referenced media for the future import service.</span></span></label></div>{preview && <PreviewSummary preview={preview} />}{result && <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-muted/50 p-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /><div><p className="font-medium">Mock import staged</p><p className="mt-1 text-xs text-muted-foreground">{result.imported} posts, {result.images} media references, and {result.tags} tags are ready for a backend migration. No content was changed.</p></div></div>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => close(false)}>Close</Button>{preview ? <Button type="button" onClick={() => void stageImport()} disabled={pending !== null}>{pending === "import" && <Loader2 className="animate-spin" />}Stage import</Button> : <Button type="button" onClick={() => void requestPreview()} disabled={pending !== null}>{pending === "preview" ? <Loader2 className="animate-spin" /> : <Upload />}Preview import</Button>}</DialogFooter></DialogContent></Dialog>;
}

function PreviewSummary({ preview }: { preview: MigrationPreview }) {
  return <section aria-label="Migration preview" className="rounded-lg border border-border"><div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">{[["Posts", preview.posts], ["Media", preview.images], ["Tags", preview.tags], ["Conflicts", preview.conflicts]].map(([label, value]) => <div key={String(label)} className="px-3 py-3 text-center"><p className="text-lg font-semibold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>)}</div><p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Preview only. ShipBrief will preserve existing updates and surface conflicts for review before a real import runs.</p></section>;
}
