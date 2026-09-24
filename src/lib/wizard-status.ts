import type { StepStatuses } from "@/components/wizard/wizard-shell";

export interface WizardIssue { text: string; step: "event" | "formats" | "assign"; blocking: boolean }

/**
 * What is complete, what is missing, and which step fixes it (PRD §6.1). Blocking issues stop publishing;
 * the rest are shown as hints. Used by the wizard rail and the Review step.
 */
export function wizardStatus(input: {
  title: string; eventDate: string | null;
  brief: { description: string | null; time_text: string | null; venue_name: string | null } | null;
  requestedSlots: { assignee_id: string | null; is_primary?: boolean }[];
}): { statuses: StepStatuses; issues: WizardIssue[] } {
  const issues: WizardIssue[] = [];
  if (!input.title.trim()) issues.push({ text: "The event has no title.", step: "event", blocking: true });
  if (!input.eventDate) issues.push({ text: "The event date is missing.", step: "event", blocking: true });
  if (!input.brief?.description) issues.push({ text: "The invite text is missing.", step: "event", blocking: true });
  if (!input.brief?.venue_name) issues.push({ text: "The venue name is missing.", step: "event", blocking: true });
  if (!input.brief?.time_text) issues.push({ text: "No timings are written for the design.", step: "event", blocking: false });
  if (input.requestedSlots.length === 0) issues.push({ text: "No formats are requested.", step: "formats", blocking: true });
  if (input.requestedSlots.length > 0 && !input.requestedSlots.some((s) => s.is_primary)) issues.push({ text: "No format is marked Primary (the one kept after the event).", step: "formats", blocking: false });
  const unassigned = input.requestedSlots.filter((s) => !s.assignee_id).length;
  if (unassigned > 0 && input.requestedSlots.length > 0) issues.push({ text: unassigned === input.requestedSlots.length ? "No format has a designer yet." : `${unassigned} of ${input.requestedSlots.length} formats have no designer yet.`, step: "assign", blocking: false });
  const has = (step: WizardIssue["step"]) => issues.some((i) => i.step === step);
  return { statuses: { event: has("event") ? "incomplete" : "done", formats: has("formats") ? "incomplete" : "done", assign: has("assign") ? "incomplete" : "done" }, issues };
}
