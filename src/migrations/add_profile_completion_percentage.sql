-- Add profile_completion_percentage column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0;

-- Update existing users with a default value
UPDATE users 
SET profile_completion_percentage = 0 
WHERE profile_completion_percentage IS NULL;