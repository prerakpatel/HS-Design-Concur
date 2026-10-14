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

### What should NOT happen
- [ ] Nothing posted in the real Slack or Google Chat channels. If anything did, stop and check the sandbox organisation's Settings → Organizations has no webhook.

**Do not run the daily job (`/api/jobs/daily`) to test.** It covers every organisation, so it would send real reminders and digests to the real channels.

## Clean up
Delete the test events (event menu → Delete). Soft-deleted events and their files are removed after
`DELETE_RESTORE_DAYS`. The sandbox itself can stay.
