import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
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
  const place = where.page === "asset" ? "looking at a design" : where.page === "project" ? "on a project page" : where.page === "projects" ? "on the projects list" : "elsewhere in the app";
  messages[messages.length - 1] = { role: "user", content: `[${place}: ${where.path}]\n${last.content as string}` };

  const response = await anthropic().messages.parse({
    model: ASSISTANT_MODEL,
    max_tokens: 4000,
    output_config: { effort: ASSISTANT_EFFORT, format: zodOutputFormat(OutcomeSchema) },
    system: [
      { type: "text", text: INSTRUCTIONS, cache_control: { type: "ephemeral" } },
      { type: "text", text: "CONTEXT\n" + context, cache_control: { type: "ephemeral" } },
    ],
    messages,
  });
  if (response.stop_reason === "refusal") return { outcome: unclear("I can't help with that one."), raw: "" };
  const outcome = response.parsed_output;
  if (!outcome) return { outcome: unclear("I lost the thread there. Say it once more?"), raw: "" };
  const raw = response.content.find((b) => b.type === "text")?.text ?? JSON.stringify(outcome);
  return { outcome, raw };
}

