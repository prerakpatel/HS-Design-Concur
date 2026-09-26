"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { Icon } from "@/components/material-icon";
import { TEXT_COLORS, type TextColor } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// icons: format_bold format_italic format_underlined format_color_text format_list_bulleted link link_off text_format close check
export interface EditorMember { id: string; name: string; handle: string; avatar?: string | null }

/** A text colour from the small palette, stored as <span data-color="red">. */
const Colored = Mark.create<{ HTMLAttributes: Record<string, unknown> }>({
  name: "colored",
  addAttributes() { return { color: { default: null, parseHTML: (el) => el.getAttribute("data-color"), renderHTML: (attrs) => (attrs.color ? { "data-color": attrs.color } : {}) } }; },
  parseHTML() { return [{ tag: "span[data-color]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]; },
});

/**
 * "- " (or "* ") at the start of a line becomes a bullet. Tiptap's own input rule covers ordinary keyboards; this
 * repeats the check after every change, because composing keyboards (Gboard, some iOS layouts) insert text
 * without the keystroke the input rule listens for.
 */
const DashBullet = Extension.create({
  name: "dashBullet",
  onUpdate() {
    const { state } = this.editor; const { $from, empty } = state.selection;
    if (!empty || $from.parent.type.name !== "paragraph" || $from.depth !== 1) return;
    // After a Shift+Enter line break the "line" starts at the break, not at the paragraph.
    let breakAt = -1;
    $from.parent.forEach((node, offset) => { if (node.type.name === "hardBreak" && offset < $from.parentOffset) breakAt = offset; });
    const lineStart = breakAt >= 0 ? breakAt + 1 : 0;
    const line = $from.parent.textBetween(lineStart, $from.parentOffset, undefined, "\ufffc");
    if (!/^[-*]\s$/.test(line)) return;
    const start = $from.start(); const cursor = start + $from.parentOffset;
    queueMicrotask(() => {
      if (breakAt >= 0) this.editor.chain().deleteRange({ from: start + breakAt, to: cursor }).splitBlock().toggleBulletList().run();
      else this.editor.chain().deleteRange({ from: start, to: cursor }).toggleBulletList().run();
    });
  },
});

/** Inside a bullet, Shift+Enter starts the next bullet (like Enter) instead of a soft line break. */
const ListEnter = Extension.create({
  name: "listEnter",
  priority: 1000,
  addKeyboardShortcuts() {
    return { "Shift-Enter": () => (this.editor.isActive("listItem") ? this.editor.commands.splitListItem("listItem") : false) };
  },
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
  const mobile = useIsMobile();
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ heading: false, strike: false, code: false, codeBlock: false, blockquote: false, orderedList: false, horizontalRule: false, link: false, underline: undefined }),
      // inclusive: false → typing right after a link continues as plain text (bold / italic / underline still extend).
      Link.extend({ inclusive: false }).configure({ openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Colored,
      DashBullet,
      ListEnter,
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
  const tools = <Tools editor={editor} link={{ open: linkOpen, value: linkValue, setValue: setLinkValue, openIt: openLink, apply: applyLink, close: () => setLinkOpen(false) }} colorOpen={colorOpen} setColorOpen={(v) => { setColorOpen(v); if (v) setLinkOpen(false); }} />;

  return (
    <div className={cn("relative rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", className)}>
      {/* Phones: the row lives above the text so it sits right over the keyboard. Desktop: the same tools hover
          over the selection, and the link field takes the pill's place. One or the other, never both. */}
      {mobile ? (
        <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">{tools}</div>
      ) : (
        <BubbleMenu editor={editor} shouldShow={({ editor, state }) => (!state.selection.empty || linkOpen) && editor.isEditable} options={{ placement: "top", offset: 8 }} className="flex items-center gap-0.5 rounded-xl bg-foreground p-1 text-background shadow-xl">
          {tools}
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

interface LinkState { open: boolean; value: string; setValue: (v: string) => void; openIt: () => void; apply: () => void; close: () => void }

function Tools({ editor, link, colorOpen, setColorOpen }: { editor: Editor; link: LinkState; colorOpen: boolean; setColorOpen: (v: boolean) => void }) {
  const btn = (active: boolean) => cn("flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-current/10", active && "bg-current/15");
  const color = editor.getAttributes("colored").color as TextColor | undefined;
  if (link.open) {
    // The toolbar becomes the link field, so it is always exactly where the tools were.
    return (
      <div className="flex h-8 min-w-[260px] items-center gap-1.5 pl-2">
        <Icon name="link" className="!text-[18px] opacity-70" />
        <input autoFocus value={link.value} onChange={(e) => link.setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); link.apply(); } if (e.key === "Escape") { e.preventDefault(); link.close(); } }} placeholder="Type or paste a link" inputMode="url" className="min-w-0 flex-1 bg-transparent text-sm text-current outline-none placeholder:text-current/50" />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={link.apply} className="rounded-lg px-2.5 py-1 text-sm font-medium hover:bg-current/10">Apply</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={link.close} aria-label="Close" className="flex size-7 items-center justify-center rounded-lg hover:bg-current/10"><Icon name="close" className="!text-[18px]" /></button>
      </div>
    );
  }
  return (
    <>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold" aria-pressed={editor.isActive("bold")} className={btn(editor.isActive("bold"))}><Icon name="format_bold" className="!text-[20px]" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic" aria-pressed={editor.isActive("italic")} className={btn(editor.isActive("italic"))}><Icon name="format_italic" className="!text-[20px]" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline" aria-pressed={editor.isActive("underline")} className={btn(editor.isActive("underline"))}><Icon name="format_underlined" className="!text-[20px]" /></button>
      <span className="relative">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setColorOpen(!colorOpen)} aria-label="Text colour" aria-expanded={colorOpen} className={btn(!!color)}><Icon name="format_color_text" className="!text-[20px]" /></button>
        {colorOpen && (
          <span className="absolute left-1/2 top-full z-30 mt-2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-foreground p-2.5 shadow-xl">
            <Swatch label="Default text" active={!color} className="swatch-default" onPick={() => { editor.chain().focus().unsetMark("colored").run(); setColorOpen(false); }} />
            {TEXT_COLORS.map((c) => <Swatch key={c} label={c} active={color === c} className={`swatch-${c}`} onPick={() => { editor.chain().focus().setMark("colored", { color: c }).run(); setColorOpen(false); }} />)}
          </span>
        )}
      </span>
      <span className="mx-0.5 h-5 w-px bg-current/25" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list" aria-pressed={editor.isActive("bulletList")} className={btn(editor.isActive("bulletList"))}><Icon name="format_list_bulleted" className="!text-[20px]" /></button>
      <span className="mx-0.5 h-5 w-px bg-current/25" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={link.openIt} aria-label="Link" aria-pressed={editor.isActive("link")} className={btn(editor.isActive("link"))}><Icon name="link" className="!text-[20px]" /></button>
    </>
  );
}

function Swatch({ label, active, className, onPick }: { label: string; active: boolean; className: string; onPick: () => void }) {
  return <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onPick} aria-label={label} aria-pressed={active} className={cn("size-7 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.35)] ring-2 ring-offset-2 ring-offset-foreground transition-transform hover:scale-110", active ? "ring-background" : "ring-transparent", className)} />;
}
