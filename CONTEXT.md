# Design & Concur — domain glossary

Use these terms exactly. Avoid the synonyms listed.

| Term | Meaning | Not |
|---|---|---|
| **Organisation (org)** | Harisumiran (the temple) or Atmiya Care Charities, ACC (the non-profit wing). Every event belongs to one. Each org is a separate view. | tenant, workspace, team |
| **Event** | A festival or programme that needs assets. Has one date, one brief, many format slots. | project, campaign |
| **Brief** | The event-level content: description, timing lines, venue, notes. Written once, locked at first upload. | content, copy |
| **Brief** | What goes on the designs: date, timings (one free-text block, as written on the design), invite text, venue name and address. | copy, content |
| **Format** | A catalog row: a named size/medium such as *IG Post 1080 × 1350*. | asset type, medium, template |
| **Slot** | A format applied to an event. Either *Requested* or *N/A*. Holds versions. | asset request, task |
| **Harisumiran / ACC** | The two org display names. ACC is the short form of Atmiya Care Charities. | temple, non-profit |
| **N/A** | Slot state meaning "not being produced for this event". Hidden from pending counts, re-requestable. | skipped, disabled |
| **Version** | One upload to a slot, numbered v1, v2… Print versions have a Front and optional Back side. | revision, draft, file |
| **Optimised file** | The only stored rendition of an upload. Served on approved download. | original |
| **Preview** | The watermarked rendition shown before approval. | proof |
| **Reference** | The tiny post-purge image kept per approved slot. | archive copy |
| **Approver** | A user with the Approve capability. Core Admins are Approvers implicitly. | reviewer, executive |
| **Core Admin** | The only admin role. | admin, sub-admin, owner |
| **Function tag** | Central, Publication, Designer. Informational; routes notifications. | role, department |
| **Central** | Function tag for the executive team. | exec, leadership |
| **Publication** | Function tag for the content/writing team. | publisher, writer |
| **Reopen** | Approver action that pulls an approved slot back to *Changes requested*. | un-approve, revoke |
| **Addressed / Confirmed** | Comment flags: addressed by the designer, confirmed by an approver. | resolved, closed |
| **Event cap** | 10 non-draft, non-archived events across both orgs. | quota |
| **Purge** | Nightly job 7 days after an event date: keep references, delete everything else, archive the event. | cleanup, GC |
| **Draft sweep** | Nightly deletion of drafts untouched for 30 days (warning at day 23). | expiry |
| **Restore window** | The 7 days after a delete in which a Core Admin can undo it. | undelete |
