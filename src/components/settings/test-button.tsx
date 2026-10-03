"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TestButton({ label, action, done = "Sent. Check the channel or your inbox." }: { label: string; action: () => Promise<void>; done?: string }) {
  const [pending, start] = useTransition();
  return <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => { try { await action(); toast.success(done); } catch (e) { toast.error((e as Error).message); } })}>{pending ? "Sending…" : label}</Button>;
}
