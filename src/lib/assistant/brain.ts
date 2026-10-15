import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ASSISTANT_EFFORT, ASSISTANT_MODEL, ASSISTANT_NAME } from "@/config/assistant";
import { OutcomeSchema, type Outcome, type Turn, type Where } from "@/lib/assistant/schema";
import { unclear } from "@/lib/assistant/outcome";
import { UserError } from "@/lib/user-error";

/**
 * The assistant's one job: turn what the person said (in English, Gujarati or both, with the umms) into one of the
 * app's cards. It never acts; the person taps. Facts come only from the context: it must not invent dates, sizes
 * or people, and says so in `gaps` instead.
 */
const INSTRUCTIONS = `You are ${ASSISTANT_NAME}, the assistant inside Design & Concur, the app a temple's design team uses to request, review and approve designs ("projects" are events with "formats": the designs needed for them, such as a print card, a WhatsApp flyer, an Instagram post, an LED screen or a website hero).

People talk to you the way they talk: Indian English, American English, Gujarati, or all three in one sentence, with fillers ("umm", "shoot, what was it", "okay thanks"). Drop the fillers, keep the meaning. Keep Gujarati and temple words as they are, spelled as the GLOSSARY has them; never "correct" them to English words.

You reply with exactly one card (the JSON schema):
- draft: when you understood what to create. Fill projects, addFormats or comments. Put anything you could not fill in gaps instead of guessing.
- question: only when one missing answer blocks everything (for example which project a comment is about, when two fit). Prefer a draft with gaps over a question.
- unclear: when you cannot tell what was wanted.
- unsupported: when the app can do it but you cannot (uploading a file, changing settings, approving); give the link.
- answer: a plain answer to a question about the projects in the context ("what is pending on Annakut?").

Rules:
- Formats: pick from FORMATS by meaning ("something for WhatsApp and Telegram" is the WhatsApp/messaging format; "Instagram" the social post; "card for print" a print format). Give a custom size only when the person said one and the format allows it. If a size is unknown, leave size null and add a gap. "Same assets as X" copies X's formats.
- "Like last year": look for a project with the same name in PROJECTS from a year ago. If it is there, use its sizes; if not, say so in gaps. Never invent sizes.
- Dates: only when the person said one, or a date is certain from the context. Otherwise eventDate null (no gap needed; the form asks).
- Several things at once ("and also one for kids annakut with the same") → several projects in one draft.
- Comments: "tell X to…", "ask X…", "check that…", "make sure…" are change requests (change = true) with one item per point, written as complete, polite sentences the designer can act on, in the person's words. Mention the people named, by id from PEOPLE; names that match nobody go in unresolved. "This design" / "this card" is the slot the person is looking at (marked in PROJECTS); otherwise find the format on the project named; if no project fits, ask.
- Adding formats to an existing project → addFormats with that project's id.
- Filling in a project's details (date, venue, timings, invite text, notes, a new title), giving a format to a person ("give the print card to Chirantan", "Nikhil does the WhatsApp one"), or publishing ("publish it", "make it live") → updateProject with that project's id. Set only the fields the person gave; the rest null. For assignments use the slot id from PROJECTS and the person's id from PEOPLE. If they say "publish" but PROJECTS says it still needs something they did not give, set publish true anyway and put what is missing in gaps (the app will refuse politely).
- "It" / "this project" is the project the person is looking at or setting up (marked in PROJECTS), or the one just created in this thread.
- When a draft was just created or the person asks what is missing, say in 'say' what it still needs before it can be published (from PROJECTS), and invite them to just say it.
- Ids: use only ids from the context, exactly as written. Never invent one.
- say: one warm, short line; no emoji; never repeat the whole draft in it. When there are gaps, say what needs the person's touch.
- Follow-ups edit the previous draft ("drop LED from the kids one", "make it 5 by 7"): reply with the whole updated draft, not just the change.`;

let client: Anthropic | null = null;
const anthropic = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("The assistant is not switched on yet (no ANTHROPIC_API_KEY)");
  client ??= new Anthropic();
  return client;
};

export const assistantReady = () => !!process.env.ANTHROPIC_API_KEY;

export async function think(context: string, thread: Turn[], where: Where): Promise<{ outcome: Outcome; raw: string }> {
  const messages: Anthropic.MessageParam[] = thread.map((t) => (t.role === "user" ? { role: "user", content: t.text } : { role: "assistant", content: t.raw }));
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new UserError("Nothing to answer");
  // The person's place in the app rides on the last message, so the context (cached) stays byte-identical between turns.
  const last = messages[messages.length - 1];
  const place = where.page === "asset" ? "looking at a design" : where.page === "project" ? "on a project page" : where.page === "wizard" ? "setting up a project (the wizard's steps: event details, formats, designers, review)" : where.page === "projects" ? "on the projects list" : "elsewhere in the app";
  messages[messages.length - 1] = { role: "user", content: `[${place}: ${where.path}]\n${last.content as string}` };

  // The answer's shape is described in the prompt and checked here, rather than enforced by the API's strict output
  // format: that format has a size limit the card schema outgrew. The model is reliable at this; a bad answer is
  // sent back once with what was wrong.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: INSTRUCTIONS + "\n\nReply with one JSON object only, matching this JSON Schema exactly (every property present, null where it does not apply), with no prose and no code fences:\n" + SCHEMA_JSON, cache_control: { type: "ephemeral" } },
    { type: "text", text: "CONTEXT\n" + context, cache_control: { type: "ephemeral" } },
  ];
  const ask = async (msgs: Anthropic.MessageParam[]) => {
    const response = await anthropic().messages.create({ model: ASSISTANT_MODEL, max_tokens: 4000, output_config: { effort: ASSISTANT_EFFORT }, system, messages: msgs });
    if (response.stop_reason === "refusal") return { refusal: true as const, text: "" };
    return { refusal: false as const, text: response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim() };
  };
  const first = await ask(messages);
  if (first.refusal) return { outcome: unclear("I can't help with that one."), raw: "" };
  let parsed = parseOutcome(first.text);
  if (!parsed.ok) {
    const again = await ask([...messages, { role: "assistant", content: first.text || "{}" }, { role: "user", content: `That was not valid: ${parsed.error}. Reply again with only the JSON object.` }]);
    parsed = again.refusal ? { ok: false, error: "refused" } : parseOutcome(again.text);
    if (!parsed.ok) return { outcome: unclear("I lost the thread there. Say it once more?"), raw: "" };
  }
  return { outcome: parsed.outcome, raw: parsed.raw };
}

const SCHEMA_JSON = JSON.stringify(z.toJSONSchema(OutcomeSchema));

/** The model's text as an Outcome: the first {...} in it, checked against the schema. */
function parseOutcome(text: string): { ok: true; outcome: Outcome; raw: string } | { ok: false; error: string } {
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "no JSON object in the reply" };
  const raw = text.slice(start, end + 1);
  let data: unknown;
  try { data = JSON.parse(raw); } catch (e) { return { ok: false, error: `JSON could not be parsed (${e instanceof Error ? e.message : "syntax"})` }; }
  const r = OutcomeSchema.safeParse(data);
  if (!r.success) return { ok: false, error: r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, outcome: r.data, raw };
}

