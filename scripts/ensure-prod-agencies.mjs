#!/usr/bin/env node
/**
 * Ensure production agencies exist in local database before importing users
 * 
 * This script creates any missing agencies referenced by production users.
 * 
 * Usage: node scripts/ensure-prod-agencies.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Agency IDs found in production users
const requiredAgencies = [
  {
    id: 'seed-agency-main',
    name: 'Main Agency (Seed)',
    isActive: true,
  },
  {
    id: 'cmnz24j6e0005wz6q1xbk1z9v',
    name: 'Signed Agency',
    isActive: true,
  },
  {
    id: 'cmo0abjwq00002xg880fv8z9h',
    name: 'AXPO Spain',
    isActive: true,
  },
  {
    id: 'test-agency-barcelona',
    name: 'Barcelona Test Agency',
    isActive: true,
  },
  {
    id: 'test-agency-madrid',
    name: 'Madrid Test Agency',
    isActive: true,
  },
  {
    id: 'test-agency-valencia',
    name: 'Valencia Test Agency',
    isActive: true,
  },
];

async function main() {
  console.log('🏢 Ensuring required agencies exist...\n');

  let created = 0;
  let existing = 0;

  for (const agency of requiredAgencies) {
    try {
      const existingAgency = await prisma.agency.findUnique({
        where: { id: agency.id }
      });

      if (existingAgency) {
        console.log(`✓ Agency already exists: ${agency.name} (${agency.id})`);
        existing++;
      } else {
        await prisma.agency.create({
          data: {
            id: agency.id,
            name: agency.name,
            isActive: agency.isActive,
            createdByUserId: null, // Will be set after user import if needed
            updatedByUserId: null,
          }
        });
        console.log(`✨ Created agency: ${agency.name} (${agency.id})`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Error processing agency ${agency.id}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Agency Summary:');
  console.log('='.repeat(60));
  console.log(`✨ New agencies created: ${created}`);
  console.log(`✓ Already existing: ${existing}`);
  console.log('='.repeat(60));
  console.log('\n✅ All required agencies are now available!');
  console.log('💡 You can now run: node scripts/import-prod-users.mjs');
}

main()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
