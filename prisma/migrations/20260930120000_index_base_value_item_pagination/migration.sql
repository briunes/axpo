-- PostgREST pages base-value items by baseValueSetId and id. The existing
-- (baseValueSetId, key) index cannot satisfy ORDER BY id, so every page sorts
-- the whole set (observed spilling to disk). Preserve the existing row order.
-- Run outside a transaction: CONCURRENTLY keeps normal writes available.
CREATE INDEX CONCURRENTLY "base_value_items_baseValueSetId_id_idx"
ON "public"."base_value_items" ("baseValueSetId", "id");
