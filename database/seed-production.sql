-- Production seed data for Internship Platform
-- This file contains only essential data needed for production

-- Insert default admin user (change password after first login!)
INSERT INTO users (id, email, password_hash, full_name, role, profile_complete, verified) VALUES
-- Default admin (password: admin123 - CHANGE THIS IN PRODUCTION!)
('00000000-0000-0000-0000-000000000001', 'admin@yourcompany.com', '$2a$12$ESubmzdUAMHYDQBFPplRO.62PJAuVzQMtoFTb63jNfstP6OfKk2/W', 'System Administrator', 'admin', true, true)
ON CONFLICT (id) DO NOTHING;

-- You can add other essential production data here
-- For example: default categories, system settings, etc.