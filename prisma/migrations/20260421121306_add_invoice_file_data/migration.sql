-- AlterTable
ALTER TABLE "simulations" ADD COLUMN     "invoiceFileData" BYTEA,
ADD COLUMN     "invoiceFileMimeType" TEXT,
ADD COLUMN     "invoiceFileName" TEXT,
ADD COLUMN     "invoiceFileSize" INTEGER;
