-- Add entity_status enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('active', 'frozen');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column to marketers table
ALTER TABLE marketers ADD COLUMN IF NOT EXISTS status entity_status DEFAULT 'active';

-- Add status column to cafeterias table
ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS status entity_status DEFAULT 'active';
