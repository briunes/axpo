/**
 * seed-email-variables.mjs
 *
 * Inserts/updates email-specific template variables in the DB with
 * appropriate `templateTypes` so the editor only shows relevant variables
 * per email template type.
 *
 * Run with:
 *   node scripts/seed-email-variables.mjs
 */

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const EMAIL_VARIABLES = [
  // ── User / Auth ────────────────────────────────────────────────────────────
  {
    key: "USER_NAME",
    label: "User Name",
    description: "Full name of the user receiving the email",
    category: "user",
    example: "João Silva",
    sortOrder: 10,
    templateTypes: "user-welcome,welcome,password-reset,magic-link,otp",
  },
  {
    key: "USER_EMAIL",
    label: "User Email",
    description: "Email address of the user",
    category: "user",
    example: "joao.silva@example.com",
    sortOrder: 11,
    templateTypes: "user-welcome,welcome,password-reset,magic-link,otp",
  },
  {
    key: "USER_PIN",
    label: "User PIN",
    description: "User's numeric PIN for the platform",
    category: "user",
    example: "4829",
    sortOrder: 12,
    templateTypes: "user-welcome,welcome",
  },
  {
    key: "USER_PASSWORD",
    label: "User Password",
    description: "User's initial password (shown only on creation)",
    category: "user",
    example: "Axpo#2026",
    sortOrder: 13,
    templateTypes: "user-welcome,welcome",
  },
  {
    key: "SETUP_PASSWORD_URL",
    label: "Setup Password URL",
    description: "One-time link for the user to set their password",
    category: "user",
    example: "https://app.axpo.com/internal/setup-password?token=abc123",
    sortOrder: 14,
    templateTypes: "user-welcome,welcome",
  },
  {
    key: "RESET_PASSWORD_URL",
    label: "Reset Password URL",
    description: "Link for the user to reset their password",
    category: "user",
    example: "https://app.axpo.com/internal/reset-password?token=xyz456",
    sortOrder: 15,
    templateTypes: "password-reset",
  },
  {
    key: "MAGIC_LINK",
    label: "Magic Login Link",
    description: "One-time passwordless login link (expires in 15 min)",
    category: "user",
    example: "https://app.axpo.com/auth/magic/xyz",
    sortOrder: 16,
    templateTypes: "magic-link",
  },
  {
    key: "OTP_CODE",
    label: "OTP Code",
    description: "6-digit one-time verification code for two-factor authentication",
    category: "user",
    example: "483921",
    sortOrder: 17,
    templateTypes: "otp",
  },
  {
    key: "OTP_VALIDITY_MINUTES",
    label: "OTP Validity (Minutes)",
    description: "Number of minutes the OTP code remains valid",
    category: "user",
    example: "10",
    sortOrder: 18,
    templateTypes: "otp",
  },

  // ── Simulation share / expiry ──────────────────────────────────────────────
  {
    key: "CONTACT_PERSON",
    label: "Contact Person",
    description: "Client contact person name",
    category: "client",
    example: "María García",
    sortOrder: 25,
    templateTypes: "simulation-share,expiring-soon,converted",
  },
  {
    key: "SIMULATION_LINK",
    label: "Simulation Link",
    description: "Public URL for the client to view the simulation",
    category: "simulation",
    example: "https://app.axpo.com/s/abc123",
    sortOrder: 150,
    templateTypes: "simulation-share,expiring-soon,converted",
  },
  {
    key: "PIN",
    label: "Access PIN",
    description: "PIN code required to access the simulation",
    category: "simulation",
    example: "4829",
    sortOrder: 160,
    templateTypes: "simulation-share,expiring-soon",
  },
  {
    key: "EXPIRES_IN_DAYS",
    label: "Expires In (Days)",
    description: "Number of days until the simulation expires",
    category: "simulation",
    example: "30",
    sortOrder: 170,
    templateTypes: "simulation-share,expiring-soon",
  },
  {
    key: "OWNER_PHONE",
    label: "Owner Phone",
    description: "Commercial / owner phone number",
    category: "user",
    example: "+34 600 123 456",
    sortOrder: 220,
    templateTypes: "simulation-share,expiring-soon,converted",
  },

  // ── System ─────────────────────────────────────────────────────────────────
  {
    key: "CURRENT_YEAR",
    label: "Current Year",
    description: "Automatically replaced with the current calendar year (e.g. 2026)",
    category: "system",
    example: "2026",
    sortOrder: 999,
    templateTypes: null, // available in ALL template types
  },
];

async function main() {
  console.log("──────────────────────────────────────────────────────");
  console.log("  Email template variable seeder");
  console.log("──────────────────────────────────────────────────────\n");

  let inserted = 0;
  let updated = 0;

  for (const v of EMAIL_VARIABLES) {
    const existing = await prisma.templateVariable.findUnique({ where: { key: v.key } });
    if (existing) {
      await prisma.templateVariable.update({ where: { key: v.key }, data: v });
      updated++;
      console.log(`  ↻  Updated  ${v.key}`);
    } else {
      await prisma.templateVariable.create({ data: { ...v, active: true } });
      inserted++;
      console.log(`  ✓  Inserted ${v.key}`);
    }
  }

  console.log(`\n✅  Done — inserted ${inserted}, updated ${updated}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
