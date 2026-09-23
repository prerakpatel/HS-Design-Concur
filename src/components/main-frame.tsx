"use client";
import { usePathname } from "next/navigation";

/** The content column. Task screens (the asset page) get the full width and manage their own padding. */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const wide = /\/events\/[^/]+\/slots\/|\/preview\/slot$/.test(usePathname());
  return <main className={wide ? "w-full" : "mx-auto w-full max-w-[1120px] px-5 pb-28 pt-4 md:px-10 md:pb-16 md:pt-8"}>{children}</main>;
}
