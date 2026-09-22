# Moving simulation incidents between environments

Deploy the incident workflow and transfer migrations to both environments before transferring data. No export, import, notification, or email is triggered by deploying these changes.

1. Sign in as a **SYS_ADMIN** in the source environment.
2. Open **Simulation incidents**, select the desired rows using the checkboxes, and choose **Export incidents** in the selection action bar. Only selected rows are exported.
3. Sign in as a **SYS_ADMIN** in the destination environment and choose **Import incidents** in the top navbar.
4. Select the exported JSON file, review the counts and missing references, then choose **Import incidents** in the preview dialog.

A branch deployment imports into its configured database. Branches sharing the same database do not have separate incident records.

## Transfer behavior

- Version 1 JSON archives include incident descriptions, both status workflows, resolution notes, timestamps, snapshots, attachments, and status history.
- Incident numbers are unique within each environment. Exports include the source number; new imports receive a destination number and retain the source number in their import history. Older archives without numbers remain supported.
- Existing incident IDs are skipped; destination incidents are never overwritten.
- Users are matched by email. Missing required user links use the importing sys admin, with original identities recorded in history; missing optional handlers remain unassigned.
- Simulations are linked only when the source ID and reference match. Otherwise, the incident retains its reference and snapshot without a simulation link.
- An import history entry records the source reporter, handler, archive date, and importing sys admin.
- Imports do not send escalation notifications or email.
- Each import is one atomic database operation, including its attachments and history. A failed operation rolls back the whole archive.
- Both endpoints check the exact SYS_ADMIN role. Ordinary ADMIN users cannot export, preview, or import.

Each archive supports up to **100 incidents and 100 MiB**, including base64-encoded files. Select fewer incidents for larger batches. A single incident exceeding this limit cannot be transferred with this version.
