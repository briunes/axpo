-- CreateTable
CREATE TABLE "pdf_template_translations" (
    "id" TEXT NOT NULL,
    "pdfTemplateId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_template_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template_translations" (
    "id" TEXT NOT NULL,
    "emailTemplateId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pdf_template_translations_pdfTemplateId_languageCode_key" ON "pdf_template_translations"("pdfTemplateId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "email_template_translations_emailTemplateId_languageCode_key" ON "email_template_translations"("emailTemplateId", "languageCode");

-- AddForeignKey
ALTER TABLE "pdf_template_translations" ADD CONSTRAINT "pdf_template_translations_pdfTemplateId_fkey" FOREIGN KEY ("pdfTemplateId") REFERENCES "pdf_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_translations" ADD CONSTRAINT "email_template_translations_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: seed existing templates with an "en" translation
INSERT INTO "email_template_translations" ("id", "emailTemplateId", "languageCode", "subject", "htmlContent", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    id,
    'en',
    subject,
    "htmlContent",
    NOW(),
    NOW()
FROM "email_templates"
WHERE "isDeleted" = false;

INSERT INTO "pdf_template_translations" ("id", "pdfTemplateId", "languageCode", "htmlContent", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    id,
    'en',
    "htmlContent",
    NOW(),
    NOW()
FROM "pdf_templates"
WHERE "isDeleted" = false;
