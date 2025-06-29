-- Add views tracking to internships table
ALTER TABLE internships ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Create internship_views table to track individual views
CREATE TABLE IF NOT EXISTS internship_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    viewer_ip INET,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_internship_views_internship_id ON internship_views(internship_id);
CREATE INDEX IF NOT EXISTS idx_internship_views_viewer_id ON internship_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_internship_views_viewed_at ON internship_views(viewed_at);

-- Function to update views count
CREATE OR REPLACE FUNCTION update_internship_views_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE internships 
    SET views_count = (
        SELECT COUNT(*) 
        FROM internship_views 
        WHERE internship_id = NEW.internship_id
    )
    WHERE id = NEW.internship_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update views count
DROP TRIGGER IF EXISTS trigger_update_internship_views_count ON internship_views;
CREATE TRIGGER trigger_update_internship_views_count
    AFTER INSERT ON internship_views
    FOR EACH ROW
    EXECUTE FUNCTION update_internship_views_count();