# Testing on the live app without telling anyone

The app has a **Test sandbox** organisation. It has no chat webhooks, chat and email are off, and it is closed to sign-ups.
Nothing you do in it posts to Slack or Google Chat, and nobody sees it unless a Core Admin adds them.

## One-time setup (two Core Admins)

Approving needs a second person: nobody can approve a version they uploaded. So two Core Admins are in the sandbox.

1. Settings → Users → open your own row → tick **Test sandbox** under organisations → Save.
2. Open the second admin's row → tick **Test sandbox** and mark them **Approver** for it → Save.
3. Use the organisation switcher (sidebar) to switch to **Test sandbox**. Everything below happens there.

Push notifications and in-app notices still reach the admins in the sandbox; they never reach anyone else.

## Checklist

Designer = you. Approver = the second admin (a second browser profile or phone works too).

### Create
- [ ] New request → **For event** → fill the brief → pick a print format (with a back) and a digital format → publish.
- [ ] New request → **Assets only** → add two items → publish.

### Upload and replace (as designer)
- [ ] Drop a PNG on the digital format. It appears with the DRAFT mark; "v1 created".
- [ ] Upload another PNG before sending. It says "v1 updated", still v1.
- [ ] Send for review. The slot moves to In review.
- [ ] Upload again. A dialog asks **Fix v1 or Save as v2**. Pick Fix: "v1 updated · approvers already see it".
- [ ] Upload again, pick **Save as v2**. v2 exists.
- [ ] Print format: drag a file over the page. Front and Back halves appear. Drop on Back: "Back side added".
- [ ] Drop **two** images at once on the print format. A confirmation shows both; Swap works; Upload both saves them.
- [ ] Use the upload icon on the back image to replace just the back. The front is untouched.
- [ ] Upload a file with the wrong type or over 8 MB. A clear error; nothing is left behind.
- [ ] Rename a PNG to `.gif` and upload it to a format that accepts GIFs: "That file is not a GIF." Rename a text file to `.pdf` on a print format: "That file is not a PDF."
- [ ] A very large print PDF (a banner size) uploads and previews, at a lower resolution, instead of failing.
- [ ] A 2x file (for example 2160 x 2700 for a 1080 x 1350 format) shows no size warning.

### Review (as approver)
- [ ] Open the asset: Design / Preview toggle works; Guides is greyed out in Preview, not hidden.
- [ ] Comment: pin a comment, post a general one, edit your own, delete your own.
- [ ] Review mode: add two comments, then Send. They go out together.
- [ ] Type a comment in the thread box: a small "Request a change" toggle appears. Leave it off and post: a plain comment, nothing changes, no "Mark as done".
- [ ] Type a comment, @ someone (the list only appears after the first letters), pick them: the toggle reads "Assign to {first name}". Turn it on and post: the version goes to Changes requested and the comment shows "Change · {name}".
- [ ] Toggle on with no @: it says "Change for {uploader's first name}".
- [ ] Review mode (Comment button, pins): there is no toggle; the bar says "N changes" and "Send change(s)". Sending flips the version to Changes requested.
- [ ] Anyone, designers included, sees the toggle on the newest sent version and can request a change; it sends the version back to Changes requested.
- [ ] On an **approved** version, turning the toggle on shows "Reopen v3?" with a warning. Keep it approved = nothing changes; "Reopen and request the change" = the version reopens and the designer is told.
- [ ] Approve with a change still open: the dialog says "N changes are still open".

### Round trip (as designer, then approver)
- [ ] Upload after feedback. It creates **v3**, not a replace; the thread shows "Updated in v3".
- [ ] Send, then approve as the approver. The slot becomes Approved.
- [ ] Try to approve your own upload (as designer): blocked with a clear message.
- [ ] Replace only the back of the approved print version. It asks "Save as v4?" and carries the front over.
- [ ] Reopen an approved version. It returns to Changes requested.

### Housekeeping
- [ ] Delete icon (top right of the image) opens the confirmation; deleting a version works.
- [ ] Download the approved ZIP from the event page.

### Guests, stage 1: access and read-only (needs a second Google account that is in no organisation)
Use any Gmail address of yours that has never been added to an organisation. Make a throwaway Slack channel or
Google Chat space for this test (not a real team channel).
- [ ] On a published sandbox project, click **People**. Empty: "Everyone in Test sandbox can open this project…".
- [ ] Add the Gmail address. The list now shows the creator, the sandbox approvers and Core Admins, and the Gmail as
      **Guest · Hasn't signed in yet**. The amber note says the project posts to the main channels, where guests aren't.
      The People button has an amber dot.
- [ ] Remove an approver: works. Try to remove the last approver: the × is greyed out ("One approver stays").
- [ ] Connect chat. Slack: in the test channel type `/invite @Design & Concur`, right-click the channel → Copy link,
      paste, Connect (needs chat:write, docs/notifications.md → Project channels). Google Chat: the space → Apps &
      integrations → Webhooks → Add → paste. A hello naming everyone lands there; the panel says "Posting to …".
- [ ] Paste something wrong (a Google Chat room URL, a channel name): a clear "Paste a Slack channel link…" error.
- [ ] Sign in with the Gmail (private window). No "You are on the list" screen: it lands on **Your projects** with
      only this project. The top bar has Your projects, Inbox and the avatar (Sign out). No sidebar, archive, glossary, settings.
- [ ] As the guest, open the project: no Edit, no Delete, no Download. **People** lists only the project's people.
- [ ] As the guest, open a format: the design and its comments show; no approve, assign or other people's delete.
- [ ] As the guest, type `/events`, `/archive`, `/glossary`, `/settings` in the address bar: each sends you back to Your projects.
- [ ] As a member, comment on that format and @mention the guest (they are in the @ list). The comment posts in the
      test channel, **not** the sandbox's (or any) main channel, and the guest gets it in their Inbox.
- [ ] Disconnect the chat: the amber note is back and this project posts to the main channels again (the sandbox has
      none, so nothing appears anywhere).
- [ ] Delete the project (event menu → Delete): the guest's Your projects is empty and the link 404s. (Archiving closes it the same way.)

### Guests, stage 2: comment, ask for changes, upload (as the guest from stage 1, project chat connected)
- [ ] Post a comment. It shows in the thread; the project chat gets it; members get it in their Inbox.
- [ ] The @ list shows only the people on the project (no one else from the organisation, no groups).
- [ ] Turn on "Request a change" on a sent version and post: the version goes to Changes requested.
- [ ] Upload a design to a format that is **not** assigned to you: it works (v1, or a new version), then Send for review.
      Approvers are told; the project chat gets the post with the preview.
- [ ] Your own upload: the delete icon works. Someone else's version: no delete icon.
- [ ] No Approve button anywhere, no assign dropdown, no Edit event, no Download.
- [ ] Edit and delete your own comment; you can't edit anyone else's.
- [ ] As a member, with the chat **disconnected**, comment again: the post goes to the main channel (none in the
      sandbox), not to the old project chat.

### Notifications and organisations
- [ ] Inbox rows show the organisation (for people in more than one) before the project name.
- [ ] Tap a notification that belongs to the other organisation: the app switches to it and opens the page (no "not found").
- [ ] A person removed from an organisation no longer sees that organisation's notifications; access requests and digests (no organisation) stay.
- [ ] A guest's Inbox shows only notifications about their own projects.
- [ ] Phone: a top bar shows the organisation switcher (left) and the bell with its count (right, the only Inbox entry; the bottom bar has Projects, Archive, Glossary, Profile); the slots line is desktop-only.

### Safety nets (after the full review)
- [ ] Double-click **Next** on the first step of a new request: only one draft is made.
- [ ] A new event dated more than 6 months out: the date picker will not offer it; if it somehow gets through, a message appears and what you typed stays.
- [ ] Press Enter in a wizard text field: it goes to the next step, not "Save and exit".
- [ ] Settings → Groups → open a group → **Delete group**: only the confirmation opens, nothing is saved first. The same for Users → **Remove**.
- [ ] Double-click **Approve**: approved once, one notification. Approve right after someone requests a change: it refuses with "changed while you were deciding".
- [ ] Open a sent version as approver, have the designer replace the file (Fix v1), then Approve on the old screen: it refuses and asks you to reload.
- [ ] Comment, resolve, approve, assign: the page updates once (no flicker from a second reload).
- [ ] Type in the thread box, then post a pinned comment: the thread box keeps what you typed.
- [ ] "Approve and download": if the download fails, the version is still approved and a message says so.
- [ ] Phone: Glossary search stays visible under the top bar while scrolling.
- [ ] As an "as things happen" user, a due-date reminder arrives by email once, not twice.

### Design files are protected (database guard)
Do these in the **Test sandbox**. Use the designer account (member) and the Core Admin account.
- [ ] As designer: upload a PNG to a format, upload another over it (v1 updated), send for review. All work as before.
- [ ] As designer: on a print format add a front, then a back; replace only the back. Works.
- [ ] As designer: after the version is **approved**, try Delete on its file or Replace: the app already says only a Core Admin can. Nothing changes.
- [ ] As Core Admin: delete the approved version's back; it works.
- [ ] As approver: approve, reopen, approve again. Works; the files are untouched.
- [ ] Upload with the approver account after the designer's version is approved: a new version (v2), as before.
- [ ] Download the ZIP of the approved designs: it starts right away and every file is inside, in the order of the formats. Two formats with the same name both appear (the second as "name (2).jpg").

### Approving your own work (database guard)
- [ ] Designer A (also an approver) uploads and sends a version. A cannot approve it: "You cannot approve a version you uploaded".
- [ ] Core Admin replaces the file on the designer's pending version (Fix v1): it works, and the version now shows the Core Admin as uploader.
- [ ] Approve, reopen and approve again on a version someone else uploaded: all work.

### Notifications, push and headers (after the second review round)
- [ ] Post a very long comment (several paragraphs) on a version of a project with chat connected: the chat post still arrives, shortened, with the "Open in Design & Concur" link at the end.
- [ ] Type `@alex` in a comment when the team has an Alexander and an Alex: only the exact name is mentioned. Writing someone's email address in a comment mentions nobody.
- [ ] Open the Inbox with more than 60 notifications: only the ones shown are marked read; the rest stay unread.
- [ ] A second push about the same format still buzzes the phone (it replaces the first one).
- [ ] Remove a person (Settings → Users → Remove): they stop receiving pushes.
- [ ] In the browser's developer tools, Network → any page: the response has `X-Frame-Options: DENY` and a `Content-Security-Policy` with `frame-ancestors 'none'`. Sign-in, uploads and downloads still work.

### Comment menu and open-comment reminders
- [ ] On someone else's plain comment there is no ⋮ menu (nothing to do with it). On a change request addressed to you it shows **Mark as done**; on your own comment it shows Edit and Delete.
- [ ] A plain comment that mentions someone never appears in "Open comments need resolving": only change requests that are not done yet do. Marking the last one done removes the asset from the next post.

### What should NOT happen
- [ ] Nothing posted in the real Slack or Google Chat channels. If anything did, stop and check the sandbox organisation's Settings → Organizations has no webhook.

**Do not run the daily job (`/api/jobs/daily`) to test.** It covers every organisation, so it would send real reminders and digests to the real channels.

## Clean up
Delete the test events (event menu → Delete). Soft-deleted events and their files are removed after
`DELETE_RESTORE_DAYS`. The sandbox itself can stay.
