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

### What should NOT happen
- [ ] Nothing posted in the real Slack or Google Chat channels. If anything did, stop and check the sandbox organisation's Settings → Organizations has no webhook.

**Do not run the daily job (`/api/jobs/daily`) to test.** It covers every organisation, so it would send real reminders and digests to the real channels.

## Clean up
Delete the test events (event menu → Delete). Soft-deleted events and their files are removed after
`DELETE_RESTORE_DAYS`. The sandbox itself can stay.
