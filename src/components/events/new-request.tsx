"use client";
import { ASSET_MAX_DAYS } from "@/config/limits";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * "New request": for an event (date, venue, invite text) or assets only (a description and an end date,
 * e.g. YouTube thumbnails or calendar covers). Orgs without assets-only requests go straight to the event flow.
 */
export function NewRequest({ assets }: { assets: boolean }) {
  if (!assets) return <Button asChild><Link href="/events/new">New request</Link></Button>;
  const item = "h-auto items-start gap-3 rounded-lg px-3 py-2.5";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button>New request<Icon name="expand_more" className="!text-[18px]" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={16} className="w-72 rounded-xl p-1.5">
        <DropdownMenuItem asChild className={item}><Link href="/events/new"><Icon name="event" className="mt-0.5" /><span><span className="block text-sm font-medium">For event</span><span className="block text-xs text-muted-foreground">Date, venue and invite text; formats for the event.</span></span></Link></DropdownMenuItem>
        <DropdownMenuItem asChild className={item}><Link href="/events/new?kind=assets"><Icon name="photo_library" className="mt-0.5" /><span><span className="block text-sm font-medium">Assets only</span><span className="block text-xs text-muted-foreground">Thumbnails, covers and other designs not tied to an event. Ends within {ASSET_MAX_DAYS} days.</span></span></Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
