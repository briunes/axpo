-- Add editable text blocks field to simulations table
-- This allows storing custom text overrides for editable template sections
ALTER TABLE "simulations" ADD COLUMN "editableTextBlocks" JSONB;