"use client";
// icons: search close content_copy edit delete add more_vert upload_file download menu_book
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/material-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { saveEntry, deleteEntry, previewImport, commitImport, type ImportPreview } from "@/app/actions/glossary";
import { indexEntries, searchGlossary, type GlossaryEntry, type Hit } from "@/lib/glossary/search";
import { termKey } from "@/lib/glossary/sound";
import { errorMessage } from "@/lib/user-error";

const VIA_NOTE: Record<Hit["via"], string> = { exact: "", variant: "another way to write it", sound: "sounds like what you typed", starts: "starts like what you typed", close: "close to what you typed", meaning: "mentioned in the meaning" };

/**
 * The glossary: type a word any way you spell it and get the approved spelling. Everyone can search; stewards
 * (canEdit) can also add, edit, delete, import and export.
 */
export function GlossaryView({ entries, canEdit }: { entries: GlossaryEntry[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ entry: GlossaryEntry | null; term: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<GlossaryEntry | null>(null);
  const index = useMemo(() => indexEntries(entries), [entries]);
  const query = q.trim();
  const hits = useMemo(() => (query ? searchGlossary(query, index) : []), [query, index]);
  const letters = useMemo(() => {
    const groups = new Map<string, GlossaryEntry[]>();
    for (const e of [...entries].sort((a, b) => termKey(a.term).localeCompare(termKey(b.term)))) {
      const l = (termKey(e.term)[0] ?? "#").toUpperCase();
      groups.set(l, [...(groups.get(l) ?? []), e]);
    }
    return [...groups];
  }, [entries]);

  const copy = (term: string) => { void navigator.clipboard?.writeText(term); toast.success(`Copied “${term}”`); };
  const best = hits[0];

  return (
    <>
      <PageHeader title="Glossary" subtitle={`${entries.length} approved spelling${entries.length === 1 ? "" : "s"} · shared by both organizations`} actions={canEdit && (
        <>
          <Button onClick={() => setEditing({ entry: null, term: "" })}><Icon name="add" />Add word</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More glossary actions"><Icon name="more_vert" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
              <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => setImporting(true)}><Icon name="upload_file" />Import from Markdown</DropdownMenuItem>
              <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" disabled={entries.length === 0} onSelect={() => exportMarkdown(entries)}><Icon name="download" />Export as Markdown</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )} />

      <div className="sticky top-0 z-20 -mx-5 mb-4 bg-background/95 px-5 py-2 backdrop-blur md:static md:mx-0 md:mb-6 md:bg-transparent md:p-0 md:backdrop-blur-none">
       <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a word, however you spell it" aria-label="Search the glossary" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="h-12 rounded-full pl-12 pr-12 text-base" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><Icon name="close" className="!text-[20px]" /></button>}
       </div>
      </div>

      {query ? (
        <>
          {best && best.via !== "exact" && best.score >= 60 && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl bg-info-soft px-5 py-4">
              <div className="min-w-0"><p className="text-sm text-info-text">You typed “{query}”. The approved spelling is</p><p className="truncate text-2xl font-semibold tracking-[-0.01em]">{best.entry.term}</p></div>
              <Button onClick={() => copy(best.entry.term)}><Icon name="content_copy" />Copy</Button>
            </div>
          )}
          {hits.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {hits.map((h) => <Row key={h.entry.id} entry={h.entry} note={h.score >= 60 || h.via === "meaning" ? VIA_NOTE[h.via] : "might be what you meant"} canEdit={canEdit} onCopy={copy} onEdit={() => setEditing({ entry: h.entry, term: h.entry.term })} onDelete={() => setRemoving(h.entry)} />)}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
              <p className="font-medium">No match for “{query}”</p>
              <p className="mt-1 text-sm text-muted-foreground">{canEdit ? "It is not in the glossary yet." : "It is not in the glossary yet. Ask a glossary steward to add it."}</p>
              {canEdit && <Button className="mt-4" variant="outline" onClick={() => setEditing({ entry: null, term: query })}><Icon name="add" />Add “{query}”</Button>}
            </div>
          )}
        </>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Icon name="menu_book" className="!text-[40px] text-muted-foreground" />
          <p className="mt-3 font-medium">The glossary is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">{canEdit ? "Add a word, or import a glossary you already have as a Markdown file." : "A glossary steward has not added any words yet."}</p>
          {canEdit && <div className="mt-5 flex justify-center gap-2"><Button onClick={() => setEditing({ entry: null, term: "" })}><Icon name="add" />Add word</Button><Button variant="outline" onClick={() => setImporting(true)}><Icon name="upload_file" />Import</Button></div>}
        </div>
      ) : (
        <div className="space-y-8">
          {letters.map(([letter, list]) => (
            <section key={letter} aria-label={`Words starting with ${letter}`}>
              <h2 className="mb-1 text-sm font-semibold tracking-wide text-muted-foreground">{letter}</h2>
              <ul className="divide-y divide-border border-y border-border">{list.map((e) => <Row key={e.id} entry={e} canEdit={canEdit} onCopy={copy} onEdit={() => setEditing({ entry: e, term: e.term })} onDelete={() => setRemoving(e)} />)}</ul>
            </section>
          ))}
        </div>
      )}

      {editing && <EntryDialog key={editing.entry?.id ?? `new-${editing.term}`} entry={editing.entry} initialTerm={editing.term} index={index} onClose={() => setEditing(null)} onDelete={(e) => { setEditing(null); setRemoving(e); }} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {removing && <DeleteDialog entry={removing} onClose={() => setRemoving(null)} />}
    </>
  );
}

function Row({ entry, note, canEdit, onCopy, onEdit, onDelete }: { entry: GlossaryEntry; note?: string; canEdit: boolean; onCopy: (t: string) => void; onEdit: () => void; onDelete: () => void }) {
  const tap = "max-md:size-10";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3.5 md:grid-cols-[minmax(180px,280px)_minmax(0,1fr)_auto] md:gap-x-8 md:gap-y-1 md:items-baseline">
      <div className="min-w-0">
        <p className="break-words text-[17px] font-semibold leading-6">{entry.term}</p>
        {entry.variants.length > 0 && <p className="text-[13px] text-muted-foreground">also {entry.variants.join(", ")}</p>}
        {note && <p className="text-[13px] text-info-text">{note}</p>}
      </div>
      <p className="col-span-2 row-start-2 min-w-0 text-[15px] leading-6 text-foreground/80 md:col-span-1 md:col-start-2 md:row-start-1">{entry.definition || <span className="text-muted-foreground/70">No meaning added</span>}</p>
      <div className="col-start-2 row-start-1 -my-1 flex items-center gap-0.5 md:col-start-3 md:justify-end">
        <Button variant="ghost" size="icon-sm" className={tap} onClick={() => onCopy(entry.term)} aria-label={`Copy ${entry.term}`}><Icon name="content_copy" className="!text-[18px]" /></Button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className={tap} aria-label={`Edit or delete ${entry.term}`}><Icon name="more_vert" className="!text-[20px]" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
              <DropdownMenuItem className="h-11 rounded-lg px-3 text-sm md:h-10" onSelect={onEdit}><Icon name="edit" />Edit</DropdownMenuItem>
              <DropdownMenuItem className="h-11 rounded-lg px-3 text-sm text-destructive-text md:h-10" onSelect={onDelete}><Icon name="delete" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}

/** Remove a word. The toast offers Undo, which puts it straight back (same spelling, meaning and other spellings). */
function DeleteDialog({ entry, onClose }: { entry: GlossaryEntry; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const remove = () => start(async () => {
    try {
      await deleteEntry(entry.id);
      onClose(); router.refresh();
      toast.success(`Deleted “${entry.term}”`, { duration: 8000, action: { label: "Undo", onClick: () => { saveEntry({ id: null, term: entry.term, definition: entry.definition ?? "", variants: entry.variants }).then(() => { toast.success(`Restored “${entry.term}”`); router.refresh(); }, (e) => toast.error(errorMessage(e))); } } });
    } catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>Delete “{entry.term}”?</DialogTitle><DialogDescription>It is removed from the glossary for everyone{entry.variants.length ? `, along with its other spellings (${entry.variants.join(", ")})` : ""}. You can undo right after.</DialogDescription></DialogHeader>
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button><Button variant="destructive" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({ entry, initialTerm, index, onClose, onDelete }: { entry: GlossaryEntry | null; initialTerm: string; index: ReturnType<typeof indexEntries>; onClose: () => void; onDelete: (e: GlossaryEntry) => void }) {
  const [term, setTerm] = useState(initialTerm);
  const [definition, setDefinition] = useState(entry?.definition ?? "");
  const [variants, setVariants] = useState<string[]>(entry?.variants ?? []);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const addVariant = (raw = draft) => { const v = raw.trim().replace(/,$/, "").trim(); if (v && !variants.some((x) => termKey(x) === termKey(v))) setVariants((vs) => [...vs, v]); setDraft(""); };
  // Heads-up while typing: is this word already there, or sounds like one that is?
  const similar = useMemo(() => (term.trim() ? searchGlossary(term, index, 4).filter((h) => h.entry.id !== entry?.id && h.score >= 80) : []), [term, index, entry]);
  const same = similar.find((h) => h.via === "exact");
  const save = () => start(async () => {
    try { await saveEntry({ id: entry?.id ?? null, term, definition, variants: draft.trim() ? [...variants, draft.trim()] : variants }); toast.success(entry ? "Saved" : `Added “${term.trim()}”`); onClose(); router.refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (!pending) save(); }}>
          <DialogHeader className="border-b border-border px-6 py-5 text-left"><DialogTitle className="text-lg">{entry ? "Edit word" : "Add a word"}</DialogTitle><DialogDescription>The spelling we print, with the other ways people write it.</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <label className="block space-y-1.5 text-sm"><span className="font-medium">Approved spelling</span>
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="aarti" autoFocus autoCapitalize="none" spellCheck={false} className="text-base md:text-sm" />
              {same ? <span className="block text-destructive-text">“{same.entry.term}” is already in the glossary.</span> : similar.length > 0 && <span className="block text-muted-foreground">Sounds like {similar.map((h) => `“${h.entry.term}”`).join(", ")}. Same word? Add it as a spelling there instead.</span>}
            </label>
            <label className="block space-y-1.5 text-sm"><span className="font-medium">Meaning <span className="font-normal text-muted-foreground">(optional)</span></span>
              <Textarea value={definition} onChange={(e) => setDefinition(e.target.value)} rows={3} className="text-base md:text-sm" placeholder="A religious ritual in which…" />
            </label>
            <div className="space-y-1.5 text-sm"><span className="font-medium">Also written as <span className="font-normal text-muted-foreground">(optional)</span></span>
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-input px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring">
                {variants.map((v) => <span key={v} className="inline-flex h-7 items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-sm">{v}<button type="button" onClick={() => setVariants(variants.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background"><Icon name="close" className="!text-[14px]" /></button></span>)}
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addVariant(); } else if (e.key === "Backspace" && !draft && variants.length) setVariants(variants.slice(0, -1)); }} onBlur={() => addVariant()} placeholder={variants.length ? "" : "arti, arthi"} autoCapitalize="none" spellCheck={false} className="min-w-[8ch] flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm" />
              </div>
              <p className="text-muted-foreground">Press Enter after each. Searching any of these finds this word.</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
            {entry ? <Button type="button" variant="ghost" className="text-destructive-text" onClick={() => onDelete(entry)}>Delete</Button> : <span />}
            <Button type="submit" size="lg" disabled={pending || !term.trim() || !!same}>{pending ? "Saving…" : entry ? "Save changes" : "Add word"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [update, setUpdate] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const count = (s: string) => preview?.rows.filter((r) => r.status === s).length ?? 0;
  const run = () => start(async () => { try { setPreview(await previewImport(text)); } catch (e) { toast.error(errorMessage(e)); } });
  const commit = () => start(async () => {
    try { const r = await commitImport(text, fileName, update); toast.success(`${r.added} word${r.added === 1 ? "" : "s"} added${r.updated ? ` · ${r.updated} updated` : ""}`); onClose(); router.refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-border px-6 py-5 text-left"><DialogTitle className="text-lg">Import from Markdown</DialogTitle><DialogDescription>One word per line, like <span className="font-mono text-[13px]">- **aarti** – A ritual of light</span>. You see what will change before anything is saved.</DialogDescription></DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!preview ? (
            <>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-4 text-sm hover:bg-subtle">
                <Icon name="upload_file" className="text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{fileName || "Choose a .md or .txt file"}</span>
                <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setFileName(f.name); setText(await f.text()); }} />
              </label>
              <label className="block space-y-1.5 text-sm"><span className="font-medium">Or paste it</span><Textarea value={text} onChange={(e) => { setText(e.target.value); setFileName(""); }} rows={7} className="font-mono text-base md:text-[13px]" placeholder="- **aarti** – A religious ritual…" /></label>
            </>
          ) : (
            <>
              <p className="text-sm"><strong>{count("new")}</strong> new{count("same") > 0 && <> · {count("same")} already there</>}{count("different") > 0 && <> · <strong>{count("different")}</strong> already there with a different meaning</>}{count("repeat") > 0 && <> · {count("repeat")} repeated in the file</>}{preview.skipped.length > 0 && <> · {preview.skipped.length} line{preview.skipped.length === 1 ? "" : "s"} not understood</>}</p>
              {count("different") > 0 && (
                <div className="space-y-2">
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl bg-subtle p-3 text-[13px]">{preview.rows.filter((r) => r.status === "different").map((r) => <li key={r.term}><strong>{r.term}</strong><br /><span className="text-muted-foreground">now: {r.existing || "no meaning"}</span><br /><span>file: {r.definition || "no meaning"}</span></li>)}</ul>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={update} onChange={(e) => setUpdate(e.target.checked)} className="size-4 rounded border-border" />Replace those meanings with the file’s</label>
                </div>
              )}
              {preview.skipped.length > 0 && <details className="text-[13px] text-muted-foreground"><summary className="cursor-pointer">Lines I could not read</summary><ul className="mt-2 space-y-1">{preview.skipped.slice(0, 8).map((s) => <li key={s.line} className="truncate">line {s.line}: {s.text}</li>)}</ul></details>}
              {count("new") === 0 && count("different") === 0 && <p className="text-sm text-muted-foreground">Nothing new to add.</p>}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          {preview ? <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending}>Back</Button> : <Button variant="ghost" onClick={onClose}>Cancel</Button>}
          {preview ? <Button size="lg" onClick={commit} disabled={pending || (count("new") === 0 && !(update && count("different") > 0))}>{pending ? "Importing…" : `Add ${count("new")} word${count("new") === 1 ? "" : "s"}${update && count("different") ? ` · update ${count("different")}` : ""}`}</Button> : <Button size="lg" onClick={run} disabled={pending || !text.trim()}>{pending ? "Reading…" : "Preview"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function exportMarkdown(entries: GlossaryEntry[]) {
  const body = [...entries].sort((a, b) => termKey(a.term).localeCompare(termKey(b.term))).map((e) => `- **${e.term}**${e.variants.length ? ` (also: ${e.variants.join(", ")})` : ""} –${e.definition ? ` ${e.definition}` : ""}`.trimEnd()).join("\n");
  const url = URL.createObjectURL(new Blob([body + "\n"], { type: "text/markdown" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "glossary.md" });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
