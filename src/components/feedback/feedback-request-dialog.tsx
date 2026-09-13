"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedbackRequest } from "@/types";

const requestSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters."),
  description: z.string().trim().min(10, "Give the team a little more context."),
  tags: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  source: z.enum(["customer", "internal"]),
});

type RequestValues = z.infer<typeof requestSchema>;

export function FeedbackRequestDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: Pick<FeedbackRequest, "title" | "description"> & Partial<FeedbackRequest>) => Promise<void>;
}) {
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { title: "", description: "", tags: "", priority: "medium", source: "customer" },
  });
  const [priority, setPriority] = useState<RequestValues["priority"]>("medium");
  const [source, setSource] = useState<RequestValues["source"]>("customer");

  const submit = async (values: RequestValues) => {
    await onCreate({
      title: values.title,
      description: values.description,
      tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      priority: values.priority,
      source: values.source,
    });
    setPriority("medium");
    setSource("customer");
    onOpenChange(false);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setPriority("medium");
      setSource("customer");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Create feature request</DialogTitle><DialogDescription>Capture a request on behalf of a customer or your team. It will remain local mock data until the API is connected.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="request-title">Request title</Label><Input id="request-title" placeholder="What should ShipBrief help customers do?" aria-invalid={Boolean(errors.title)} {...register("title")} />{errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}</div>
          <div className="space-y-2"><Label htmlFor="request-description">Context</Label><Textarea id="request-description" rows={4} placeholder="Describe the customer need, its impact, and any useful detail..." aria-invalid={Boolean(errors.description)} {...register("description")} />{errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="request-tags">Tags</Label><Input id="request-tags" placeholder="reports, workflow" {...register("tags")} /></div><div className="space-y-2"><Label htmlFor="request-priority">Priority</Label><Select value={priority} onValueChange={(value) => { if (value) { setPriority(value as RequestValues["priority"]); setValue("priority", value as RequestValues["priority"]); } }}><SelectTrigger id="request-priority" className="w-full"><SelectValue>{(value) => `${value ?? "medium"} priority`}</SelectValue></SelectTrigger><SelectContent><SelectItem value="low">Low priority</SelectItem><SelectItem value="medium">Medium priority</SelectItem><SelectItem value="high">High priority</SelectItem></SelectContent></Select></div></div>
          <div className="space-y-2"><Label htmlFor="request-source">Submitted by</Label><Select value={source} onValueChange={(value) => { if (value) { setSource(value as RequestValues["source"]); setValue("source", value as RequestValues["source"]); } }}><SelectTrigger id="request-source" className="w-full"><SelectValue>{(value) => value === "customer" ? "Customer-facing request" : "Internal request"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="customer">Customer-facing request</SelectItem><SelectItem value="internal">Internal request</SelectItem></SelectContent></Select></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}{isSubmitting ? "Creating..." : "Create request"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
