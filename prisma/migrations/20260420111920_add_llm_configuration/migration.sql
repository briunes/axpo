-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "llmApiKey" TEXT,
ADD COLUMN     "llmBaseUrl" TEXT,
ADD COLUMN     "llmEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "llmMaxTokens" INTEGER DEFAULT 2000,
ADD COLUMN     "llmModelName" TEXT DEFAULT 'llama3.2',
ADD COLUMN     "llmProvider" TEXT DEFAULT 'ollama',
ADD COLUMN     "llmTemperature" DECIMAL(65,30) DEFAULT 0.1;
