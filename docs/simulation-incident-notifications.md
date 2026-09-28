# Incident notifications

Configure the four incident email templates in **Configurations → Integrations → Automated Emails**. Edit their content and translations in **Email Templates**. The migration installs and selects editable defaults. Clearing a selection disables that email only; in-app notifications remain enabled.

| Event | Recipients (active, non-deleted users) |
| --- | --- |
| New incident | Selected ADMIN users |
| Admin status change or resolution | Selected ADMIN users and the reporter |
| Escalation and subsequent status changes or resolution | Selected ADMIN and SYS_ADMIN users and the reporter |

Each recipient receives a private in-app notification and an individual email. A reporter who is also an administrator appears only once. Reporters see updates in their notification inbox; incident management remains restricted to administrators. Imports do not trigger notifications.

Both resolved and dismissed transitions require a non-empty resolution note. The saved note is included in the resolution email even when the selected template omits the `{{RESOLUTION_NOTES}}` variable.

Templates support `INCIDENT_NUMBER`, `ISSUE_ID`, `SIMULATION_REFERENCE`, `DESCRIPTION`, `STATUS`, `PREVIOUS_STATUS`, `NOTES`, `RESOLUTION_NOTES`, `CHANGED_BY`, `RECIPIENT_NAME`, and `ISSUE_URL`. User content is escaped when inserted into HTML. Email status labels and in-app titles/status text use the recipient’s supported language preference, then the configured default language, then English. Regional codes such as es-ES are normalized to Spanish. Status labels match the incident UI. User-written descriptions and notes remain unchanged. Existing notifications are not rewritten when a preference changes.

Status notification failures leave the incident saved and return a delivery error. Saving again retries with the same transition identity, skipping successful email deliveries. Additional notes do not create a new status event. Initial report delivery failures return a warning while preserving the newly created incident, avoiding duplicate reports; email failures are recorded in email logs.

Deploy `20260922160000_add_incident_email_templates` before running the updated application. Applying this migration sends no emails. SMTP delivery must be verified separately in the target environment.


## Recipient assignment

Configurations → Simulation incidents controls incident reporting and the selected
active Admins and Sys Admins. Selected Admins receive incident notifications;
selected Sys Admins join the recipients for escalated incidents. Reporters continue
to receive updates on their own incidents, with links to their notification inbox
when they are not assigned to incident management.

Only selected Admins and Sys Admins can see Simulation Issues or access its
management APIs. Import/export additionally requires the Sys Admin role. An empty
selection removes management access for everyone; Configurations remains available
to restore the selection. Disabling reporting also hides management access.

Apply migration `20260923120000_add_incident_recipients` before running this version.
It preselects existing active Admins and Sys Admins to preserve access. Future users
must be explicitly selected. The migration has no effect on role permissions for
other sections.
