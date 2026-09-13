"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { ShipBriefLogo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Typography } from "@/components/ui/typography";
import { colors, spacing } from "@/lib/design-tokens";

const colorSwatches = [
  { name: "Background", token: "background", hex: colors.background },
  { name: "Surface", token: "surface", hex: colors.surface },
  { name: "Surface Subtle", token: "surface-subtle", hex: colors.surfaceSubtle },
  { name: "Foreground", token: "foreground", hex: colors.foreground },
  { name: "Muted", token: "muted", hex: colors.muted },
  { name: "Border", token: "border", hex: colors.border },
  { name: "Primary", token: "primary", hex: colors.primary },
  { name: "Success", token: "success", hex: colors.success },
  { name: "Warning", token: "warning", hex: colors.warning },
  { name: "Danger", token: "danger", hex: colors.danger },
];

function StateDemo() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="sb-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Loading</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 1500);
            }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Loading
              </>
            ) : (
              "Trigger loading"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="sb-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Empty</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Plus className="size-4 text-muted-foreground" />
          </div>
          <Typography variant="body-medium">No releases yet</Typography>
          <Typography variant="metadata">
            Create your first release to get started.
          </Typography>
        </CardContent>
      </Card>

      <Card className="sb-panel border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Typography variant="metadata" className="text-foreground">
            We couldn&apos;t generate this draft. Your existing content is safe.
          </Typography>
          <div className="mt-3 flex gap-2">
            <Button size="sm">Try again</Button>
            <Button size="sm" variant="outline">
              Continue manually
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="sb-panel border-[color:var(--success)]/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[color:var(--success)]">
            <CheckCircle2 className="size-4" />
            Success
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Typography variant="metadata" className="text-foreground">
            Release saved successfully.
          </Typography>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => toast.success("Release saved successfully")}
          >
            Show toast
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DesignSystemShowcase() {
  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <ShipBriefLogo />
          <Badge variant="secondary">Phase 0 · Foundation</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-12">
        <section className="space-y-3">
          <Typography variant="display">Design System</Typography>
          <Typography variant="body" className="max-w-2xl text-muted-foreground">
            ShipBrief foundation tokens, typography, brand assets, and UI
            primitives. Premium, minimal, and AI-native — calm before
            impressive.
          </Typography>
        </section>

        <section className="space-y-4">
          <Typography variant="section-title">Brand</Typography>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="sb-panel">
              <CardHeader>
                <CardTitle className="text-sm">Full wordmark</CardTitle>
                <CardDescription>For navigation and marketing</CardDescription>
              </CardHeader>
              <CardContent>
                <ShipBriefLogo iconSize={28} />
              </CardContent>
            </Card>
            <Card className="sb-panel">
              <CardHeader>
                <CardTitle className="text-sm">Icon only</CardTitle>
                <CardDescription>Compact UI · 16–24px</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <ShipBriefLogo showWordmark={false} iconSize={16} />
                <ShipBriefLogo showWordmark={false} iconSize={20} />
                <ShipBriefLogo showWordmark={false} iconSize={24} />
              </CardContent>
            </Card>
            <Card className="sb-panel bg-[#18181B]">
              <CardHeader>
                <CardTitle className="text-sm text-white">Dark surface</CardTitle>
                <CardDescription className="text-zinc-400">
                  Logo on dark backgrounds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-white">
                  <ShipBriefLogo iconSize={24} tone="light" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <Typography variant="section-title">Typography</Typography>
          <Card className="sb-panel divide-y divide-border">
            <div className="p-6">
              <Typography variant="display">Display · 40–56px</Typography>
            </div>
            <div className="p-6">
              <Typography variant="page-title">Page title · 26–32px</Typography>
            </div>
            <div className="p-6">
              <Typography variant="section-title">
                Section title · 16–20px
              </Typography>
            </div>
            <div className="p-6">
              <Typography variant="body">
                Body · 14–15px with comfortable line-height for long-form
                release content and customer-facing updates.
              </Typography>
            </div>
            <div className="p-6">
              <Typography variant="metadata">
                Metadata · 11–13px for timestamps, counts, and secondary labels
              </Typography>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <Typography variant="section-title">Color tokens</Typography>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {colorSwatches.map((swatch) => (
              <div key={swatch.token} className="sb-panel overflow-hidden">
                <div
                  className="h-16 border-b border-border"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="p-3">
                  <Typography variant="metadata-medium">{swatch.name}</Typography>
                  <Typography variant="metadata">{swatch.hex}</Typography>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <Typography variant="section-title">Spacing scale</Typography>
          <div className="flex flex-wrap items-end gap-4">
            {spacing.map((value) => (
              <div key={value} className="flex flex-col items-center gap-2">
                <div
                  className="rounded-sm bg-primary/20"
                  style={{ width: value, height: value }}
                />
                <Typography variant="metadata">{value}px</Typography>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <Typography variant="section-title">UI primitives</Typography>
          <Tabs defaultValue="controls">
            <TabsList>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="overlays">Overlays</TabsTrigger>
            </TabsList>
            <TabsContent value="controls" className="mt-4 space-y-4">
              <Card className="sb-panel">
                <CardContent className="flex flex-wrap items-end gap-4 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="search">Input</Label>
                    <div className="relative">
                      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="search"
                        className="pl-8"
                        placeholder="Search releases..."
                      />
                    </div>
                  </div>
                  <div className="min-w-[240px] space-y-2">
                    <Label htmlFor="notes">Textarea</Label>
                    <Textarea
                      id="notes"
                      placeholder="Customer-value summary..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button size="sm">
                  <Plus />
                  Small
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Draft</Badge>
                <Badge variant="outline">Scheduled</Badge>
                <Badge className="bg-[color:var(--success-muted)] text-[color:var(--success)] hover:bg-[color:var(--success-muted)]">
                  Published
                </Badge>
              </div>
            </TabsContent>
            <TabsContent value="feedback" className="mt-4">
              <StateDemo />
            </TabsContent>
            <TabsContent value="overlays" className="mt-4">
              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" />}>
                    Open dialog
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Unsaved changes</DialogTitle>
                      <DialogDescription>
                        You have unsaved changes. Stay on this page or discard
                        your edits.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">Stay</Button>
                      <Button variant="destructive">Discard</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Drawer>
                  <DrawerTrigger render={<Button variant="outline" />}>
                    Open drawer
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Mobile navigation</DrawerTitle>
                      <DrawerDescription>
                        Drawer pattern for tablet and mobile shell navigation.
                      </DrawerDescription>
                    </DrawerHeader>
                    <DrawerFooter>
                      <DrawerClose render={<Button variant="outline" className="w-full" />}>
                        Close
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-4">
          <Typography variant="section-title">Shape & surfaces</Typography>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="sb-control border border-border bg-surface p-4">
              <Typography variant="metadata-medium">Control · 6–8px</Typography>
            </div>
            <div className="sb-panel p-4">
              <Typography variant="metadata-medium">Card · 8–12px</Typography>
            </div>
            <div className="sb-panel-raised p-4">
              <Typography variant="metadata-medium">
                Raised surface · subtle shadow
              </Typography>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
