-- Add 'shortlisted' status to applications table
-- This migration adds the 'shortlisted' status to the existing CHECK constraint

-- First, drop the existing constraint
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;

-- Add the new constraint with 'shortlisted' included
ALTER TABLE applications ADD CONSTRAINT applications_status_check 
CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'accepted', 'rejected', 'withdrawn'));