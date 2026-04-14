-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permissionKey_key" ON "role_permissions"("role", "permissionKey");

-- ============================================================================
-- Seed default permissions — mirrors current hardcoded behaviour
-- ============================================================================

-- AGENT defaults
INSERT INTO "role_permissions" ("id", "role", "permissionKey", "allowed", "createdAt", "updatedAt") VALUES
('rp_agent_sec_simulations',     'AGENT', 'section.simulations',    true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_users',           'AGENT', 'section.users',          false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_agencies',        'AGENT', 'section.agencies',       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_clients',         'AGENT', 'section.clients',        true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_base_values',     'AGENT', 'section.base-values',    true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_audit_logs',      'AGENT', 'section.audit-logs',     true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_analytics',       'AGENT', 'section.analytics',      true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sec_configurations',  'AGENT', 'section.configurations', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sim_create',          'AGENT', 'simulations.create',      true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sim_share',           'AGENT', 'simulations.share',       true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sim_duplicate',       'AGENT', 'simulations.duplicate',   true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sim_archive',         'AGENT', 'simulations.archive',     true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sim_delete',          'AGENT', 'simulations.delete',      false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_agent_sim_edit_payload',    'AGENT', 'simulations.edit_payload',true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- COMMERCIAL defaults
INSERT INTO "role_permissions" ("id", "role", "permissionKey", "allowed", "createdAt", "updatedAt") VALUES
('rp_com_sec_simulations',       'COMMERCIAL', 'section.simulations',    true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_users',             'COMMERCIAL', 'section.users',          false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_agencies',          'COMMERCIAL', 'section.agencies',       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_clients',           'COMMERCIAL', 'section.clients',        false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_base_values',       'COMMERCIAL', 'section.base-values',    false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_audit_logs',        'COMMERCIAL', 'section.audit-logs',     false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_analytics',         'COMMERCIAL', 'section.analytics',      false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sec_configurations',    'COMMERCIAL', 'section.configurations', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_create',            'COMMERCIAL', 'simulations.create',      true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_share',             'COMMERCIAL', 'simulations.share',       true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_duplicate',         'COMMERCIAL', 'simulations.duplicate',   true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_archive',           'COMMERCIAL', 'simulations.archive',     true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_delete',            'COMMERCIAL', 'simulations.delete',      false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rp_com_sim_edit_payload',      'COMMERCIAL', 'simulations.edit_payload',true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
