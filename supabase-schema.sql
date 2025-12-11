-- Create clothing_items table
CREATE TABLE IF NOT EXISTS clothing_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('tops', 'bottoms', 'shoes')),
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generated_outfits table
CREATE TABLE IF NOT EXISTS generated_outfits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  top_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
  bottom_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
  shoe_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE,
  generated_image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(top_id, bottom_id, shoe_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clothing_items_category ON clothing_items(category);
CREATE INDEX IF NOT EXISTS idx_generated_outfits_top_bottom ON generated_outfits(top_id, bottom_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_clothing_items_updated_at 
  BEFORE UPDATE ON clothing_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_outfits_updated_at 
  BEFORE UPDATE ON generated_outfits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_outfits ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - you can restrict later)
CREATE POLICY "Allow all operations on clothing_items" ON clothing_items
  FOR ALL USING (true);

CREATE POLICY "Enable delete access for generated_outfits" ON generated_outfits
  FOR DELETE USING (true);
