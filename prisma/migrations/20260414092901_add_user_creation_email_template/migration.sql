-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "userCreationEmailTemplateId" TEXT;
