-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

-- Comment on new columns
COMMENT ON COLUMN users.address IS 'User''s full address';
COMMENT ON COLUMN users.instagram_url IS 'User''s Instagram profile URL';
COMMENT ON COLUMN users.twitter_url IS 'User''s Twitter/X profile URL';
COMMENT ON COLUMN users.portfolio_url IS 'User''s portfolio website URL';