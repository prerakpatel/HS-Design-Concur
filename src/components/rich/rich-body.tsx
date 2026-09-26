import { isHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * A comment body. HTML bodies were sanitised on the server when saved (src/lib/rich-text.ts), so they render as is;
 * older plain-text bodies keep their line breaks.
 */
export function RichBody({ body, className }: { body: string; className?: string }) {
  if (!isHtml(body)) return <p className={cn("whitespace-pre-wrap text-sm leading-5", className)}>{body}</p>;
  return <div className={cn("rich text-sm leading-5", className)} dangerouslySetInnerHTML={{ __html: body }} />;
}
