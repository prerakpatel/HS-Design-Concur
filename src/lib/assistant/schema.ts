import { z } from "zod";

/**
 * What the assistant may answer with. It never writes free prose: every reply is one of a few cards, each with
 * buttons, so there is always something to tap. Ids are the app's own (events, slots, people); the server checks
 * every one of them against what the person may see before anything is created.
 */
export const SizeSchema = z.object({ w: z.number(), h: z.number() });

export const FormatPickSchema = z.object({
  formatKey: z.string().describe("The key of a format from the catalogue."),
  label: z.string().nullable().describe("Only when the same format is wanted more than once in a project, to tell them apart (e.g. 'Kids'). Otherwise null."),
  size: SizeSchema.nullable().describe("A custom size in the format's own unit, only for formats that allow a custom size. Otherwise null."),
  notes: z.string().nullable().describe("Anything said about this format that the designer should know. Otherwise null."),
});

export const ProjectDraftSchema = z.object({
  title: z.string().describe("Short title in Title Case, e.g. 'Sharad Purnima & Annakut 2026'."),
  eventDate: z.string().nullable().describe("YYYY-MM-DD, only when the person gave a date or it is certain. Otherwise null."),
  venueName: z.string().nullable(),
  description: z.string().nullable().describe("What the event is, as the invite would say it. Null unless the person described it."),
  notes: z.string().nullable().describe("Notes for the designers. Null if none."),
  formats: z.array(FormatPickSchema),
  primaryFormatKey: z.string().nullable().describe("The format that stands for the project (the main design), if obvious."),
  gaps: z.array(z.string()).describe("Short lines about things you could not fill and the person must, e.g. 'Print card size: last year is not in the app'."),
});

export const AddFormatsSchema = z.object({
  eventId: z.string(),
  eventTitle: z.string(),
  formats: z.array(FormatPickSchema),
  gaps: z.array(z.string()),
});

export const CommentDraftSchema = z.object({
  eventId: z.string(),
  eventTitle: z.string(),
  slotId: z.string(),
  slotName: z.string(),
  change: z.boolean().describe("true when the person wants something fixed (a change request the designer must address); false for a plain comment."),
  mentionUserIds: z.array(z.string()).describe("Ids of the people to @mention, from the project's people. The person the work is for ('assign this to Chirantan', 'tell Chirantan') comes first: a change request is theirs to mark done."),
  unresolved: z.array(z.string()).describe("Names the person said that match nobody on the project."),
  items: z.array(z.string()).describe("One entry per point the person made, each a complete sentence in the person's words (cleaned up). Each becomes its own comment."),
});

export const ProjectUpdateSchema = z.object({
  eventId: z.string(),
  eventTitle: z.string(),
  title: z.string().nullable().describe("A new title, only if the person asked to rename it."),
  eventDate: z.string().nullable().describe("YYYY-MM-DD, only if the person gave a date."),
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  timeText: z.string().nullable().describe("The timings as they should appear on the design, e.g. '6:30 pm Sabha, 7:30 pm Annakut darshan'."),
  description: z.string().nullable().describe("The invite text: what the event is, as the invite would say it, in the person's words tidied up."),
  notes: z.string().nullable().describe("Notes for the designers."),
  assignments: z.array(z.object({ slotId: z.string(), slotName: z.string(), userId: z.string(), userName: z.string() })).describe("Formats to give to people: slot ids from PROJECTS, person ids from PEOPLE."),
  publish: z.boolean().describe("true when the person asked to publish the project."),
  gaps: z.array(z.string()).describe("Things the person must still give before it can be published, in short lines."),
});

export const OutcomeSchema = z.object({
  kind: z.enum(["draft", "question", "unclear", "unsupported", "answer"]).describe("draft: something to create or change (projects, addFormats, updateProject or comments). question: one question that blocks everything. unclear: you could not make out what was wanted. unsupported: the app can do it but not through you. answer: a plain answer to a question about the projects."),
  say: z.string().describe("One short, warm line for the person, at most 20 words. For 'answer', the answer itself (longer is fine)."),
  projects: z.array(ProjectDraftSchema).describe("New projects to create. Empty unless kind is draft."),
  addFormats: AddFormatsSchema.nullable().describe("Formats to add to an existing project. Null unless kind is draft."),
  updateProject: ProjectUpdateSchema.nullable().describe("Details, designers or publishing for an existing project. Null unless kind is draft."),
  comments: z.array(CommentDraftSchema).describe("Comments to post. Empty unless kind is draft."),
  question: z.object({ text: z.string(), options: z.array(z.string()).describe("2 to 4 short answers to tap, when the question has obvious answers; otherwise empty.") }).nullable(),
  link: z.object({ href: z.string(), label: z.string() }).nullable().describe("For unsupported: where in the app to do it (a path like /events/<id>/edit/event)."),
});

export type FormatPick = z.infer<typeof FormatPickSchema>;
export type ProjectDraft = z.infer<typeof ProjectDraftSchema>;
export type AddFormats = z.infer<typeof AddFormatsSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
export type CommentDraft = z.infer<typeof CommentDraftSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;

/** Where the person is in the app when they speak; the assistant reads "this project" and "this format" from it. */
export interface Where { page: "projects" | "project" | "asset" | "wizard" | "other"; eventId: string | null; slotId: string | null; path: string }

/** One exchange in the thread, as the browser keeps it. `raw` is the reply exactly as the model wrote it, sent back as history. */
export type Turn = { role: "user"; text: string } | { role: "assistant"; outcome: Outcome; raw: string };

/** A person the assistant may mention, for the card's pickers. */
export interface Person { id: string; name: string }
