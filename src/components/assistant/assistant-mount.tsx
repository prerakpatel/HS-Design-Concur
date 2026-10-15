"use client";
import dynamic from "next/dynamic";
import type { AssistantProps } from "@/components/assistant/assistant";

// Loaded after the page is on screen, and only for people the assistant is switched on for; everyone else never
// downloads it. Nothing of it is rendered on the server.
const Assistant = dynamic(() => import("@/components/assistant/assistant").then((m) => m.Assistant), { ssr: false });

export function AssistantMount(props: AssistantProps) { return <Assistant {...props} />; }
