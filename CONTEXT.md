# Design & Concur — domain glossary

Use these terms exactly. Avoid the synonyms listed.

| Term | Meaning | Not |
|---|---|---|
| **Organization (org)** | Harisumiran (the temple) or Atmiya Care Charities, ACC (the non-profit wing). Every event belongs to one. Each org is a separate view. | tenant, workspace, team |
| **Event** | A festival or programme that needs assets. Has one date, one brief, many format slots. | project, campaign |
| **Brief** | The event-level content: description, timing lines, venue, notes. Written once, locked at first upload. | content, copy |
| **Brief** | What goes on the designs: date, timings (one free-text block, as written on the design), invite text, venue name and address. | copy, content |
| **Format** | A catalog row: a named size/medium such as *IG Post 1080 × 1350*. | asset type, medium, template |
| **Slot** | A format applied to an event. Either *Requested* or *N/A*. Holds versions. | asset request, task |
| **Harisumiran / ACC** | The two org display names. ACC is the short form of Atmiya Care Charities. | temple, non-profit |
| **N/A** | Slot state meaning "not being produced for this event". Hidden from pending counts, re-requestable. | skipped, disabled |
| **Version** | One upload to a slot, numbered v1, v2… Print versions have a Front and optional Back side. Private until **sent for review**; the slot's state follows its newest sent version. | revision, draft, file |
| **Optimised file** | The only stored rendition of an upload. Served on approved download. | original |
| **Preview** | The watermarked rendition shown before approval. | proof |
| **Reference** | The tiny post-purge image kept for the primary format only. | archive copy |
| **Primary format** | The one format per event the other designs derive from; shown first, and the only one kept after purge. | master, hero |
| **Group** | A set of people in an org with its own chat space/channel and a "hears about" rule (everything, its own designs, milestones only). Routes chat posts; grants no permissions. Mentionable in comments as @Group. | team, channel, audience |
| **Approver** | A user granted "Can approve designs for" an organization (Settings › Users); the grant is per organization, so someone can approve for one org and not the other. Independent of Core Admin: a Core Admin who is not an Approver is not notified about reviews and cannot approve. | reviewer, executive |
| **Core Admin** | The only admin role. | admin, sub-admin, owner |
| **Function tag** | Central, Publication, Designer. Informational; routes notifications. | role, department |
| **Central** | Function tag for the executive team. | exec, leadership |
| **Publication** | Function tag for the content/writing team. | publisher, writer |
| **Reopen** | Approver action that pulls an approved slot back to *Changes requested*. | un-approve, revoke |
| **Glossary** | The list of approved spellings of satsang words (with an optional meaning), shared by both orgs, in the main nav. Text only; outside the event cap. Kept by stewards. See PRD §16. | dictionary, lexicon, wordlist |
| **Glossary steward** | A user (any org) who can add, edit, delete and import glossary words. A global switch granted by a Core Admin, independent of Approver and Core Admin. | editor, moderator |
| **Approved spelling** | The one spelling of a word we print (the glossary entry's term). Other spellings are *also written as* and resolve to it. | canonical, standard form |
| **Review mode** | | Started with the Comment button. Comments are saved as private drafts (`comments.is_draft`, visible only to their author, marked "Not sent") and go out together as one chat/in-app notification when the author presses Send. One comment keeps the classic wording; Request changes publishes any queued comments with it. | batch, pending review |
| **Maintenance hold** | Core Admin switch (Settings › Maintenance, `app_settings.maintenance`) that puts a "please hold" veil over the app for everyone but Core Admins. Pages stay mounted underneath so typed work survives; open pages poll `/api/status`. | maintenance mode, lockout |
| **Addressed / Confirmed** | Comment flags: addressed by the designer, confirmed by an approver. | resolved, closed |
| **Event cap** | 10 non-draft, non-archived events across both orgs. | quota |
| **Purge** | Nightly job 7 days after an event date: keep references, delete everything else, archive the event. | cleanup, GC |
| **Draft sweep** | Nightly deletion of drafts untouched for 30 days (warning at day 23). | expiry |
| **Restore window** | The 7 days after a delete in which a Core Admin can undo it. | undelete |
