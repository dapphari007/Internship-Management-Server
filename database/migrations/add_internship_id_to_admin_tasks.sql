-- Add internship_id to admin_tasks table to link tasks to internships
ALTER TABLE admin_tasks 
ADD COLUMN IF NOT EXISTS internship_id UUID REFERENCES internships(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_admin_tasks_internship_id ON admin_tasks(internship_id);

-- Update existing tasks to have NULL internship_id (they will be general admin tasks)
-- New tasks can be created with specific internship_id