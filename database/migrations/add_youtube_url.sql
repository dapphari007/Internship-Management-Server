-- Add youtube_url field to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS youtube_url TEXT;