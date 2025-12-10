-- Migration to add shoes support to existing database

-- Step 1: Update the CHECK constraint on clothing_items to include 'shoes'
ALTER TABLE clothing_items DROP CONSTRAINT IF EXISTS clothing_items_category_check;
ALTER TABLE clothing_items ADD CONSTRAINT clothing_items_category_check 
  CHECK (category IN ('tops', 'bottoms', 'shoes'));

-- Step 2: Only update generated_outfits if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'generated_outfits') THEN
    -- Add shoe_id column to generated_outfits table
    ALTER TABLE generated_outfits ADD COLUMN IF NOT EXISTS shoe_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE;
    
    -- Drop the old UNIQUE constraint and create a new one with shoe_id
    ALTER TABLE generated_outfits DROP CONSTRAINT IF EXISTS generated_outfits_top_id_bottom_id_key;
    ALTER TABLE generated_outfits ADD CONSTRAINT generated_outfits_top_id_bottom_id_shoe_id_key 
      UNIQUE(top_id, bottom_id, shoe_id);
  END IF;
END $$;

-- Note: This migration is safe to run on existing databases.
-- If generated_outfits table doesn't exist, only clothing_items will be updated.

