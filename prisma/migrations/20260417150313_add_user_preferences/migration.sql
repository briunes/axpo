-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "defaultDateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "defaultItemsPerPage" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "defaultNumberFormat" TEXT NOT NULL DEFAULT 'eu',
ADD COLUMN     "defaultTimeFormat" TEXT NOT NULL DEFAULT '24h',
ADD COLUMN     "defaultTimezone" TEXT NOT NULL DEFAULT 'Europe/Madrid';

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateFormat" TEXT,
    "timeFormat" TEXT,
    "timezone" TEXT,
    "numberFormat" TEXT,
    "itemsPerPage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
