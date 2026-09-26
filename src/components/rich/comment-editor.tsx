"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark, mergeAttributes } from "@tiptap/core";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { Icon } from "@/components/material-icon";
import { TEXT_COLORS, type TextColor } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

// icons: format_bold format_italic format_underlined format_color_text format_list_bulleted link link_off text_format close check
export interface EditorMember { id: string; name: string; handle: string; avatar?: string | null }

/** A text colour from the small palette, stored as <span data-color="red">. */
const Colored = Mark.create<{ HTMLAttributes: Record<string, unknown> }>({
  name: "colored",
  addAttributes() { return { color: { default: null, parseHTML: (el) => el.getAttribute("data-color"), renderHTML: (attrs) => (attrs.color ? { "data-color": attrs.color } : {}) } }; },
  parseHTML() { return [{ tag: "span[data-color]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]; },
});

/** @-mention popup: a plain list positioned at the caret, driven by Tiptap's suggestion plugin. */
function mentionSuggestion(members: EditorMember[]): Omit<SuggestionOptions<EditorMember>, "editor"> {
  return {
    char: "@",
    items: ({ query }) => { const q = query.toLowerCase(); return members.filter((m) => m.name.toLowerCase().includes(q) || m.handle.includes(q)).slice(0, 5); },
    render: () => {
      let el: HTMLDivElement | null = null; let items: EditorMember[] = []; let index = 0; let command: SuggestionProps<EditorMember>["command"] | null = null;
      const paint = () => {
        if (!el) return;
        el.innerHTML = "";
        items.forEach((m, i) => {
          const b = document.createElement("button"); b.type = "button";
          b.className = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" + (i === index ? " bg-muted" : "");
          b.textContent = m.name;
          b.addEventListener("mousedown", (e) => { e.preventDefault(); command?.({ id: m.id, label: m.name }); });
          el!.appendChild(b);
        });
        el.style.display = items.length ? "block" : "none";
      };
      const place = (rect: (() => DOMRect | null) | null | undefined) => {
        const r = rect?.(); if (!el || !r) return;
        const width = 240; const left = Math.min(r.left, window.innerWidth - width - 8);
        const below = r.bottom + 4; const above = r.top - 4;
        el.style.width = `${width}px`; el.style.left = `${Math.max(8, left)}px`;
        if (below + 200 < window.innerHeight) { el.style.top = `${below}px`; el.style.bottom = "auto"; } else { el.style.bottom = `${window.innerHeight - above}px`; el.style.top = "auto"; }
      };
      return {
        onStart: (props) => {
          el = document.createElement("div");
          el.className = "fixed z-50 overflow-hidden rounded-xl border border-border bg-card shadow-lg";
          document.body.appendChild(el);
          items = props.items; index = 0; command = props.command; paint(); place(props.clientRect);
        },
        onUpdate: (props) => { items = props.items; index = Math.min(index, Math.max(0, items.length - 1)); command = props.command; paint(); place(props.clientRect); },
        onKeyDown: ({ event }) => {
          if (!items.length) return false;
          if (event.key === "ArrowDown") { index = (index + 1) % items.length; paint(); return true; }
          if (event.key === "ArrowUp") { index = (index - 1 + items.length) % items.length; paint(); return true; }
          if (event.key === "Enter" || event.key === "Tab") { const m = items[index]; if (m) command?.({ id: m.id, label: m.name }); return true; }
          if (event.key === "Escape") { el?.remove(); el = null; return true; }
          return false;
        },
        onExit: () => { el?.remove(); el = null; },
      };
    },
  };
}

/**
 * The comment composer: bold, italic, underline, a small colour palette, one level of bullets, links and
 * @-mentions. Desktop: the tools hover over the selection. Phones: a compact row sits above the text, where it is
 * reachable with the keyboard up and does not fight the system's copy / paste bubble.
 */
export function CommentEditor({ value, onChange, onSubmit, placeholder, members, autoFocus, compact, className }: {
  value: string; onChange: (html: string, empty: boolean) => void; onSubmit?: () => void; placeholder?: string; members: EditorMember[]; autoFocus?: boolean; compact?: boolean; className?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ heading: false, strike: false, code: false, codeBlock: false, blockquote: false, orderedList: false, horizontalRule: false, link: false, underline: undefined }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Colored,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Mention.configure({ HTMLAttributes: { class: "mention" }, renderHTML: ({ node }) => ["span", { "data-type": "mention", "data-id": node.attrs.id, "data-label": node.attrs.label, class: "mention" }, `@${node.attrs.label ?? node.attrs.id}`], suggestion: mentionSuggestion(members) }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: cn("rich outline-none", compact ? "min-h-[2.5rem] px-2 py-1.5 text-sm" : "min-h-11 px-3.5 py-2.5 text-sm"), "aria-label": placeholder ?? "Comment" },
      handleKeyDown: (_view, event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submitRef.current?.(); return true; } return false; },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.isEmpty),
  });
  // Clear from outside (after posting) without recreating the editor.
  useEffect(() => { if (editor && value === "" && !editor.isEmpty) editor.commands.clearContent(); }, [value, editor]);
  if (!editor) return <div className={cn("min-h-11 rounded-xl border border-input bg-card", className)} />;

  const openLink = () => { setLinkValue(editor.getAttributes("link").href ?? ""); setLinkOpen(true); setColorOpen(false); };
  const applyLink = () => {
    const raw = linkValue.trim();
    if (!raw) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: /^https?:\/\//i.test(raw) || raw.startsWith("mailto:") ? raw : `https://${raw}` }).run();
    setLinkOpen(false);
  };
  const tools = <Tools editor={editor} onLink={openLink} colorOpen={colorOpen} setColorOpen={(v) => { setColorOpen(v); if (v) setLinkOpen(false); }} />;

  return (
    <div className={cn("relative rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", className)}>
      {/* Phones: the row lives above the text so it sits right over the keyboard. */}
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1 md:hidden">{tools}</div>
      {/* Desktop: the same tools hover over whatever is selected. */}
      <div className="max-md:hidden">
        <BubbleMenu editor={editor} shouldShow={({ editor, state }) => !state.selection.empty && editor.isEditable} options={{ placement: "top", offset: 8 }} className="flex items-center gap-0.5 rounded-xl bg-foreground p-1 text-background shadow-xl">
          {tools}
        </BubbleMenu>
      </div>
      <EditorContent editor={editor} />
      {linkOpen && (
        <div className="absolute inset-x-2 bottom-full z-20 mb-1 flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg">
          <Icon name="link" className="ml-1 !text-[18px] text-muted-foreground" />
          <input autoFocus value={linkValue} onChange={(e) => setLinkValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }} placeholder="Type or paste a link" inputMode="url" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <button type="button" onClick={applyLink} className="rounded-lg px-2.5 py-1 text-sm font-medium hover:bg-muted">Apply</button>
          <button type="button" onClick={() => setLinkOpen(false)} aria-label="Close" className="flex size-7 items-center justify-center rounded-lg hover:bg-muted"><Icon name="close" className="!text-[18px]" /></button>
        </div>
      )}
    </div>
  );
}

function Tools({ editor, onLink, colorOpen, setColorOpen }: { editor: Editor; onLink: () => void; colorOpen: boolean; setColorOpen: (v: boolean) => void }) {
  const btn = (active: boolean) => cn("flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-current/10", active && "bg-current/15");
  const color = editor.getAttributes("colored").color as TextColor | undefined;
  return (
    <>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold" aria-pressed={editor.isActive("bold")} className={btn(editor.isActive("bold"))}><Icon name="format_bold" className="!text-[20px]" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic" aria-pressed={editor.isActive("italic")} className={btn(editor.isActive("italic"))}><Icon name="format_italic" className="!text-[20px]" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline" aria-pressed={editor.isActive("underline")} className={btn(editor.isActive("underline"))}><Icon name="format_underlined" className="!text-[20px]" /></button>
      <span className="relative">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setColorOpen(!colorOpen)} aria-label="Text colour" aria-expanded={colorOpen} className={btn(!!color)}><Icon name="format_color_text" className="!text-[20px]" /></button>
        {colorOpen && (
          <span className="absolute left-1/2 top-full z-30 mt-2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-foreground p-2.5 shadow-xl">
            <Swatch label="Default" active={!color} className="bg-background" onPick={() => { editor.chain().focus().unsetMark("colored").run(); setColorOpen(false); }} />
            {TEXT_COLORS.map((c) => <Swatch key={c} label={c} active={color === c} className={`swatch-${c}`} onPick={() => { editor.chain().focus().setMark("colored", { color: c }).run(); setColorOpen(false); }} />)}
          </span>
        )}
      </span>
      <span className="mx-0.5 h-5 w-px bg-current/25" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list" aria-pressed={editor.isActive("bulletList")} className={btn(editor.isActive("bulletList"))}><Icon name="format_list_bulleted" className="!text-[20px]" /></button>
      <span className="mx-0.5 h-5 w-px bg-current/25" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onLink} aria-label="Link" aria-pressed={editor.isActive("link")} className={btn(editor.isActive("link"))}><Icon name="link" className="!text-[20px]" /></button>
    </>
  );
}

function Swatch({ label, active, className, onPick }: { label: string; active: boolean; className: string; onPick: () => void }) {
  return <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onPick} aria-label={label} aria-pressed={active} className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-foreground transition-transform hover:scale-110", active ? "ring-background" : "ring-transparent", className)} />;
}
