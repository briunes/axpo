BEGIN;

ALTER TABLE "system_config"
  ADD COLUMN "incidentCreatedEmailTemplateId" TEXT,
  ADD COLUMN "incidentEscalatedEmailTemplateId" TEXT,
  ADD COLUMN "incidentStatusEmailTemplateId" TEXT,
  ADD COLUMN "incidentResolvedEmailTemplateId" TEXT;

INSERT INTO "email_templates" ("id", "name", "description", "type", "subject", "htmlContent", "updatedAt")
VALUES ('default-incident-created', 'New incident', 'Automatic incident workflow email', 'incident-created', 'New incident: #{{INCIDENT_NUMBER}}', '<h2>New incident: #{{INCIDENT_NUMBER}}</h2><p>Hello {{RECIPIENT_NAME}},</p><p>Simulation: {{SIMULATION_REFERENCE}}</p><p>Status: {{STATUS}}</p><p>Updated by: {{CHANGED_BY}}</p><p style="white-space:pre-wrap">{{DESCRIPTION}}</p><p><a href="{{ISSUE_URL}}">View update</a></p>', CURRENT_TIMESTAMP);
ALTER TABLE "system_config" ALTER COLUMN "incidentCreatedEmailTemplateId" SET DEFAULT 'default-incident-created';
UPDATE "system_config" SET "incidentCreatedEmailTemplateId" = 'default-incident-created';

INSERT INTO "email_templates" ("id", "name", "description", "type", "subject", "htmlContent", "updatedAt")
VALUES ('default-incident-escalated', 'Incident escalated', 'Automatic incident workflow email', 'incident-escalated', 'Incident escalated: #{{INCIDENT_NUMBER}}', '<h2>Incident escalated: #{{INCIDENT_NUMBER}}</h2><p>Hello {{RECIPIENT_NAME}},</p><p>Simulation: {{SIMULATION_REFERENCE}}</p><p>Status: {{PREVIOUS_STATUS}} → {{STATUS}}</p><p>Updated by: {{CHANGED_BY}}</p><p style="white-space:pre-wrap">{{DESCRIPTION}}</p><p style="white-space:pre-wrap">{{NOTES}}</p><p><a href="{{ISSUE_URL}}">View update</a></p>', CURRENT_TIMESTAMP);
ALTER TABLE "system_config" ALTER COLUMN "incidentEscalatedEmailTemplateId" SET DEFAULT 'default-incident-escalated';
UPDATE "system_config" SET "incidentEscalatedEmailTemplateId" = 'default-incident-escalated';

INSERT INTO "email_templates" ("id", "name", "description", "type", "subject", "htmlContent", "updatedAt")
VALUES ('default-incident-status', 'Incident status changed', 'Automatic incident workflow email', 'incident-status', 'Incident status changed: #{{INCIDENT_NUMBER}}', '<h2>Incident status changed: #{{INCIDENT_NUMBER}}</h2><p>Hello {{RECIPIENT_NAME}},</p><p>Simulation: {{SIMULATION_REFERENCE}}</p><p>Status: {{PREVIOUS_STATUS}} → {{STATUS}}</p><p>Updated by: {{CHANGED_BY}}</p><p style="white-space:pre-wrap">{{DESCRIPTION}}</p><p style="white-space:pre-wrap">{{NOTES}}</p><p><a href="{{ISSUE_URL}}">View update</a></p>', CURRENT_TIMESTAMP);
ALTER TABLE "system_config" ALTER COLUMN "incidentStatusEmailTemplateId" SET DEFAULT 'default-incident-status';
UPDATE "system_config" SET "incidentStatusEmailTemplateId" = 'default-incident-status';

INSERT INTO "email_templates" ("id", "name", "description", "type", "subject", "htmlContent", "updatedAt")
VALUES ('default-incident-resolved', 'Incident finalized', 'Automatic incident workflow email', 'incident-resolved', 'Incident finalized: #{{INCIDENT_NUMBER}}', '<h2>Incident finalized: #{{INCIDENT_NUMBER}}</h2><p>Hello {{RECIPIENT_NAME}},</p><p>Simulation: {{SIMULATION_REFERENCE}}</p><p>Status: {{PREVIOUS_STATUS}} → {{STATUS}}</p><p>Updated by: {{CHANGED_BY}}</p><p style="white-space:pre-wrap">{{DESCRIPTION}}</p><h3>Resolution</h3><p style="white-space:pre-wrap">{{RESOLUTION_NOTES}}</p><p><a href="{{ISSUE_URL}}">View update</a></p>', CURRENT_TIMESTAMP);
ALTER TABLE "system_config" ALTER COLUMN "incidentResolvedEmailTemplateId" SET DEFAULT 'default-incident-resolved';
UPDATE "system_config" SET "incidentResolvedEmailTemplateId" = 'default-incident-resolved';


COMMIT;
