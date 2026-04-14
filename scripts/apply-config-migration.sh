#!/bin/bash
# Script to apply configuration migrations manually in production

echo "Applying configuration table migrations..."

# Read DATABASE_URL from .env
export $(grep -v '^#' .env | xargs)

# Execute SQL directly
psql "$DATABASE_URL" <<'EOF'
-- Create system_config table
CREATE TABLE IF NOT EXISTS "system_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "simulationExpirationDays" INTEGER NOT NULL DEFAULT 30,
    "simulationShareText" TEXT NOT NULL DEFAULT 'Your simulation is ready. Access it with PIN: {PIN}',
    "enablePixelTracking" BOOLEAN NOT NULL DEFAULT true,
    "requirePinForAccess" BOOLEAN NOT NULL DEFAULT true,
    "pinLength" INTEGER NOT NULL DEFAULT 4,
    "autoCreateClientOnSim" BOOLEAN NOT NULL DEFAULT false,
    "enableAnalyticsModule" BOOLEAN NOT NULL DEFAULT true,
    "enableAuditLogsModule" BOOLEAN NOT NULL DEFAULT true,
    "defaultDashboardView" TEXT NOT NULL DEFAULT 'COMMERCIAL',
    "enableRealtimeReports" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create pdf_templates table
CREATE TABLE IF NOT EXISTS "pdf_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "htmlContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

EOF

echo "✓ Tables created successfully"
echo "Now run: node scripts/seed-configurations.mjs"
