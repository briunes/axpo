-- Restrict simulation Excel downloads to elevated roles by default.
-- SYS_ADMIN permissions are implicit and are not stored in this table.
INSERT INTO "role_permissions" ("id", "role", "permissionKey", "allowed", "createdAt", "updatedAt") VALUES
('rp_agent_sim_download_excel', 'AGENT', 'simulations.download_excel', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_download_excel', 'COMMERCIAL', 'simulations.download_excel', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permissionKey") DO UPDATE
SET "allowed" = false, "updatedAt" = CURRENT_TIMESTAMP;
