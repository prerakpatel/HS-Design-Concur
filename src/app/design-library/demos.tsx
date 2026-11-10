"use client";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

async function copy(text: string, label?: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`Copied ${label ?? text}`); }
  catch { toast.error("Could not copy. Select the text and copy it by hand."); }
}

/** Anything that copies a value when pressed. */
export function Copy({ value, label, className, children }: { value: string; label?: string; className?: string; children: React.ReactNode }) {
  return <button type="button" onClick={() => copy(value, label)} className={cn("text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>{children}</button>;
}

/** A colour swatch. Pressing it copies the Tailwind class. */
export function Swatch({ token, value, cls, use, bordered }: { token: string; value: string; cls: string; use: string; bordered?: boolean }) {
  return (
    <Copy value={cls} className="group rounded-xl">
      <span className={cn("block h-16 rounded-xl", bordered && "ring-1 ring-inset ring-border")} style={{ background: `var(--${token})` }} />
      <span className="mt-2 flex items-center gap-1 text-sm font-medium">{token}<Icon name="content_copy" className="!text-[14px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></span>
      <span className="block font-mono text-xs text-muted-foreground">{value}</span>
      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{use}</span>
    </Copy>
  );
}

/** A code sample with a copy button. */
export function Code({ code }: { code: string }) {
  return (
    <div className="relative rounded-xl bg-subtle ring-1 ring-border">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-5 text-sidebar-foreground"><code>{code}</code></pre>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy code" className="absolute right-2 top-2" onClick={() => copy(code, "code")}><Icon name="content_copy" className="!text-[16px]" /></Button>
    </div>
  );
}

/** Every icon the app uses, searchable. Pressing one copies its name. */
export function IconGallery({ names }: { names: readonly string[] }) {
  const [q, setQ] = useState("");
  const shown = names.filter((n) => n.includes(q.trim().toLowerCase().replace(/\s+/g, "_")));
  return (
    <div>
      <div className="relative max-w-xs">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${names.length} icons`} aria-label="Search icons" className="pl-10" />
      </div>
      {shown.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No icon by that name.</p> : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
          {shown.map((n) => (
            <Copy key={n} value={n} className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors hover:bg-subtle">
              <Icon name={n} size={24} />
              <span className="w-full truncate text-[11px] text-muted-foreground">{n}</span>
            </Copy>
          ))}
        </div>
      )}
    </div>
  );
}

/** Plays an entrance animation again on request. */
export function Replay({ children, label = "Play again" }: { children: React.ReactNode; label?: string }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-start gap-3">
      <div key={run} className="w-full">{children}</div>
      <Button type="button" variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}><Icon name="replay" className="!text-[16px]" />{label}</Button>
    </div>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => toast.success("Event saved")}>Success</Button>
      <Button type="button" variant="outline" onClick={() => toast.error("Could not save. Try again.")}>Error</Button>
      <Button type="button" variant="outline" onClick={() => toast.warning("This file is larger than usual")}>Warning</Button>
      <Button type="button" variant="outline" onClick={() => toast.info("A new version is available")}>Info</Button>
      <Button type="button" variant="outline" onClick={() => toast("Comment deleted", { action: { label: "Undo", onClick: () => {} } })}>With action</Button>
    </div>
  );
}

export function OverlayDemos() {
  const [tip, setTip] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger asChild><Button type="button" variant="outline">Dialog</Button></DialogTrigger>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Delete this event?</DialogTitle><DialogDescription>Its formats, versions and comments go with it. This cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <DialogClose asChild><Button type="button" variant="destructive">Delete event</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer>
        <DrawerTrigger asChild><Button type="button" variant="outline">Drawer (phones)</Button></DrawerTrigger>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Approve this design?</DrawerTitle><DrawerDescription>The designer is told straight away and the file becomes downloadable.</DrawerDescription></DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild><Button type="button" size="lg">Approve</Button></DrawerClose>
            <DrawerClose asChild><Button type="button" size="lg" variant="ghost">Not yet</Button></DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Sheet>
        <SheetTrigger asChild><Button type="button" variant="outline">Sheet</Button></SheetTrigger>
        <SheetContent>
          <SheetHeader><SheetTitle>Comments</SheetTitle><SheetDescription>A side panel for content that sits next to the page, like a conversation or details.</SheetDescription></SheetHeader>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" variant="outline">Menu<Icon name="expand_more" className="!text-[18px]" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem><Icon name="edit" className="!text-[18px]" />Edit</DropdownMenuItem>
          <DropdownMenuItem><Icon name="content_copy" className="!text-[18px]" />Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive"><Icon name="delete" className="!text-[18px]" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild><Button type="button" variant="outline">Popover</Button></PopoverTrigger>
        <PopoverContent align="start" className="w-64 text-sm">A small floating panel anchored to its trigger: a date picker, a colour palette, a short form.</PopoverContent>
      </Popover>

      <Tooltip open={tip} onOpenChange={setTip}>
        <TooltipTrigger asChild><Button type="button" variant="outline" onClick={() => setTip((v) => !v)}>Tooltip</Button></TooltipTrigger>
        <TooltipContent side="top">Opens on hover, and on tap for touch screens</TooltipContent>
      </Tooltip>
    </div>
  );
}
