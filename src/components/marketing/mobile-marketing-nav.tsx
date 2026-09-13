"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const links = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
];

export function MobileMarketingNav() {
  return (
    <Drawer swipeDirection="right">
      <DrawerTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Open navigation" />}>
        <Menu />
      </DrawerTrigger>
      <DrawerContent className="max-w-[22rem]">
        <DrawerHeader className="flex-row items-center justify-between border-b border-border p-4 pb-4 text-left">
          <DrawerTitle>Explore ShipBrief</DrawerTitle>
          <DrawerClose render={<Button variant="ghost" size="icon-sm" aria-label="Close navigation" />}>
            <X />
          </DrawerClose>
        </DrawerHeader>
        <nav className="flex flex-col gap-1 p-3" aria-label="Mobile marketing navigation">
          {links.map((link) => (
            <DrawerClose key={link.href} nativeButton={false} render={<a href={link.href} className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />}>
              {link.label}
            </DrawerClose>
          ))}
          <DrawerClose nativeButton={false} render={<Link href="/c/acme" className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />}>
            Public changelog
          </DrawerClose>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
