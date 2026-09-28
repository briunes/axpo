export const INCIDENT_EMAILS = [
  { field: "incidentCreatedEmailTemplateId", type: "incident-created", label: "emailCreated" },
  { field: "incidentEscalatedEmailTemplateId", type: "incident-escalated", label: "emailEscalated" },
  { field: "incidentStatusEmailTemplateId", type: "incident-status", label: "emailStatus" },
  { field: "incidentResolvedEmailTemplateId", type: "incident-resolved", label: "emailResolved" },
] as const;

export const INCIDENT_EMAIL_VARIABLES = ["ISSUE_ID", "INCIDENT_NUMBER", "SIMULATION_REFERENCE", "DESCRIPTION", "STATUS", "PREVIOUS_STATUS", "NOTES", "RESOLUTION_NOTES", "CHANGED_BY", "RECIPIENT_NAME", "ISSUE_URL"] as const;
