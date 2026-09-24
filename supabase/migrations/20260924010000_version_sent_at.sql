-- Applied 2026-09-24. Uploading no longer sends a version for review; the designer does that explicitly.
alter table versions add column if not exists sent_at timestamptz;
-- Every version so far went to review the moment it was uploaded.
update versions set sent_at = created_at where sent_at is null;
