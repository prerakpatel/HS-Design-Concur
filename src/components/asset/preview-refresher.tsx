"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Asks the server to re-stamp previews that carry an old DRAFT mark, then reloads the page data. Runs once. */
export function PreviewRefresher({ sideIds }: { sideIds: string[] }) {
  const router = useRouter();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || sideIds.length === 0) return; ran.current = true;
    fetch("/api/uploads/refresh-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sideIds }) })
      .then((r) => r.ok ? r.json() : null).then((r: { done?: number } | null) => { if (r?.done) router.refresh(); }).catch(() => {});
  }, [sideIds, router]);
  return null;
}
