ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "requestCacheConfig" JSONB;

NOTIFY pgrst, 'reload schema';
