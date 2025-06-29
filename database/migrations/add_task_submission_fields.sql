-- Add submission and feedback fields to admin_tasks table
ALTER TABLE admin_tasks 
  -- Update status check constraint to include 'rejected'
  DROP CONSTRAINT IF EXISTS admin_tasks_status_check;

ALTER TABLE admin_tasks 
  ADD CONSTRAINT admin_tasks_status_check 
  CHECK (status IN ('pending', 'in-progress', 'completed', 'rejected'));

-- Add submission fields
ALTER TABLE admin_tasks 
  ADD COLUMN IF NOT EXISTS github_link TEXT,
  ADD COLUMN IF NOT EXISTS deployment_link TEXT,
  ADD COLUMN IF NOT EXISTS reddit_post_link TEXT,
  ADD COLUMN IF NOT EXISTS video_explanation_link TEXT,
  ADD COLUMN IF NOT EXISTS additional_notes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS feedback_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_admin_tasks_submitted_at ON admin_tasks(submitted_at);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_feedback_by ON admin_tasks(feedback_by);