#!/bin/bash

# Script to sync local database to Supabase preview database
# This will dump the local database and restore it to the preview environment

set -e  # Exit on any error

echo "🔄 Starting database sync from local to preview..."
echo ""

# Local database credentials
LOCAL_HOST="localhost"
LOCAL_PORT="5432"
LOCAL_USER="axpo"
LOCAL_DB="axpo_simulator"
LOCAL_PASSWORD="axpo_dev_password"

# Preview database credentials (from .env.preview)
PREVIEW_USER="postgres"
PREVIEW_PASSWORD="z8yrmaaKArH2q2Bj"
PREVIEW_HOST="db.tqfrbokmqqzamdcvpwhu.supabase.co"
PREVIEW_PORT="5432"
PREVIEW_DB="postgres"

# Temporary dump file
DUMP_FILE="./tmp_db_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "📦 Step 1: Dumping local database..."
echo "   Database: $LOCAL_DB"
echo "   Host: $LOCAL_HOST:$LOCAL_PORT"
echo ""

# Export password to avoid interactive prompt
export PGPASSWORD=$LOCAL_PASSWORD

# Dump the local database (schema + data)
pg_dump -h $LOCAL_HOST \
        -p $LOCAL_PORT \
        -U $LOCAL_USER \
        -d $LOCAL_DB \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        -f $DUMP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Local database dumped successfully to: $DUMP_FILE"
    echo "   Size: $(ls -lh $DUMP_FILE | awk '{print $5}')"
else
    echo "❌ Failed to dump local database"
    exit 1
fi

echo ""
echo "📤 Step 2: Restoring to Supabase preview database..."
echo "   Host: $PREVIEW_HOST:$PREVIEW_PORT"
echo "   Database: $PREVIEW_DB"
echo ""

# Export preview password
export PGPASSWORD=$PREVIEW_PASSWORD

# Restore to preview database
psql -h $PREVIEW_HOST \
     -p $PREVIEW_PORT \
     -U $PREVIEW_USER \
     -d $PREVIEW_DB \
     -f $DUMP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully to preview!"
else
    echo "❌ Failed to restore database to preview"
    echo "   The dump file is still available at: $DUMP_FILE"
    exit 1
fi

echo ""
echo "🧹 Cleaning up temporary dump file..."
rm -f $DUMP_FILE
echo "✅ Cleanup complete"

echo ""
echo "✨ Database sync completed successfully!"
echo ""
echo "⚠️  Remember to run migrations on preview if needed:"
echo "   npx dotenv -e .env.preview -- npx prisma migrate deploy"
echo ""
