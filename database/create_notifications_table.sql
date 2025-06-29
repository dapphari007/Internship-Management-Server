-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    action_url VARCHAR(500),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for notifications
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample notifications for testing
INSERT INTO notifications (user_id, title, message, type, action_url) 
SELECT 
    u.id,
    'Welcome to the Platform!',
    'Thank you for joining our internship platform. Start exploring opportunities today!',
    'info',
    '/internships'
FROM users u 
WHERE NOT EXISTS (
    SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.title = 'Welcome to the Platform!'
)
LIMIT 5;

INSERT INTO notifications (user_id, title, message, type, action_url) 
SELECT 
    u.id,
    'New Application Received',
    'You have received a new application for your internship posting.',
    'success',
    '/applications'
FROM users u 
WHERE u.role = 'company'
AND NOT EXISTS (
    SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.title = 'New Application Received'
)
LIMIT 3;

INSERT INTO notifications (user_id, title, message, type) 
SELECT 
    u.id,
    'Profile Incomplete',
    'Please complete your profile to get better internship recommendations.',
    'warning'
FROM users u 
WHERE u.role = 'student'
AND NOT EXISTS (
    SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.title = 'Profile Incomplete'
)
LIMIT 3;