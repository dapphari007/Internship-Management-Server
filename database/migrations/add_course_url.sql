-- Add course_url field to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_url TEXT;