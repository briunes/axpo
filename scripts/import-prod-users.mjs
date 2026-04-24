#!/usr/bin/env node
/**
 * Import production users from users_rows.sql into local database
 * 
 * This script reads the JSON array of users from production and imports them
 * into the local database, handling missing fields appropriately.
 * 
 * Usage: node scripts/import-prod-users.mjs
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting production users import...\n');

  // Read the JSON file
  const jsonPath = join(__dirname, '..', 'users_rows.sql');
  const jsonContent = readFileSync(jsonPath, 'utf-8');
  const prodUsers = JSON.parse(jsonContent);

  console.log(`📊 Found ${prodUsers.length} users to import\n`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of prodUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { id: user.id }
      });

      // Prepare user data with proper field mapping
      const userData = {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        mobilePhone: user.mobilePhone,
        commercialPhone: user.commercialPhone,
        commercialEmail: user.commercialEmail,
        otherDetails: user.otherDetails,
        passwordHash: user.passwordHash,
        setupToken: user.setupToken,
        setupTokenExpiresAt: user.setupTokenExpiresAt ? new Date(user.setupTokenExpiresAt) : null,
        // These fields don't exist in prod JSON, set defaults
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        pinHash: user.pinHash,
        pinCurrent: user.pinCurrent,
        pinRotatedAt: new Date(user.pinRotatedAt),
        isActive: user.isActive,
        isDeleted: false, // Default value, not in prod JSON
        deletedAt: null, // Default value, not in prod JSON
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
        createdByUserId: user.createdByUserId,
        updatedByUserId: user.updatedByUserId,
      };

      if (existingUser) {
        // Update existing user
        await prisma.user.update({
          where: { id: user.id },
          data: userData
        });
        console.log(`✅ Updated: ${user.email} (${user.fullName})`);
        updated++;
      } else {
        // Create new user
        await prisma.user.create({
          data: userData
        });
        console.log(`✨ Imported: ${user.email} (${user.fullName})`);
        imported++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${user.email}: ${error.message}`);
      
      // Check if it's a foreign key constraint error (agency doesn't exist)
      if (error.code === 'P2003') {
        console.error(`   ⚠️  Agency ${user.agencyId} doesn't exist in local database`);
      }
      
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Import Summary:');
  console.log('='.repeat(60));
  console.log(`✨ New users imported: ${imported}`);
  console.log(`✅ Existing users updated: ${updated}`);
  console.log(`⏭️  Users skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  if (errors > 0) {
    console.log('\n⚠️  Some users could not be imported. Common issues:');
    console.log('   - Referenced agencies (agencyId) do not exist in local database');
    console.log('   - Email conflicts with existing users');
    console.log('\n💡 Tip: You may need to import agencies first or create them manually.');
  }
}

main()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
