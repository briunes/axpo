ALTER TABLE "app_error_logs"
ADD COLUMN "pagePath" TEXT;

CREATE INDEX "app_error_logs_pagePath_idx"
ON "app_error_logs"("pagePath");
