import { getActiveUser } from "@/lib/auth";
import { assistantAllowed } from "@/lib/assistant/access";
import { loadAssistantProps } from "@/lib/assistant/props";
import { AssistantMount } from "@/components/assistant/assistant-mount";

/** The project setup pages have their own frame; the assistant still comes along for the people it is switched on for. */
export default async function WizardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveUser();
  const assistant = ctx && assistantAllowed(ctx.user) ? await loadAssistantProps(ctx.supabase) : null;
  return <>{children}{assistant && <AssistantMount {...assistant} />}</>;
}
