"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { marketingLinks } from "./marketing-links";
import { ThemeSegmented } from "@/components/theme/theme-toggle";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

const links = [
  ...marketingLinks,
  { href: "/login", label: "Sign in" },
];

export function MobileMarketingNav() {
  return (
    <Drawer swipeDirection="right">
      <DrawerTrigger render={<Button variant="ghost" size="icon" className="size-9 md:hidden" aria-label="Open menu" />}>
        <Menu />
      </DrawerTrigger>
      <DrawerContent className="max-w-[20rem]">
        <DrawerHeader className="flex-row items-center justify-between border-b border-border p-4 text-left">
          <DrawerTitle>Menu</DrawerTitle>
          <DrawerClose render={<Button variant="ghost" size="icon-sm" aria-label="Close menu" />}>
            <X />
          </DrawerClose>
        </DrawerHeader>
        <nav className="flex flex-col p-2" aria-label="Mobile">
          {links.map((link) => (
            <DrawerClose
              key={link.href}
              nativeButton={false}
              render={<Link href={link.href} className="rounded-md px-3 py-3 text-[15px] text-foreground transition-colors hover:bg-surface-subtle" />}
            >
              {link.label}
            </DrawerClose>
          ))}
        </nav>
        <div className="mt-auto space-y-4 border-t border-border p-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Appearance</p>
            <ThemeSegmented />
          </div>
          <DrawerClose
            nativeButton={false}
            render={<Link href="/signup" className={buttonVariants({ variant: "cta", size: "pill", className: "w-full" })} />}
          >
            Get started
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
