-- DEVELOPMENT seed data for Internship Platform
-- This file contains demo data for development and testing
-- DO NOT use this in production - use seed-production.sql instead

-- Insert demo users
INSERT INTO users (id, email, password_hash, full_name, role, bio, location, phone, university, major, graduation_year, gpa, skills, interests, profile_complete, verified) VALUES
-- Admin user (password: admin123)
('00000000-0000-0000-0000-000000000001', 'admin@internshippro.com', '$2a$12$ESubmzdUAMHYDQBFPplRO.62PJAuVzQMtoFTb63jNfstP6OfKk2/W', 'System Administrator', 'admin', 'Platform administrator with full access to manage users, content, and system settings.', 'San Francisco, CA', '+1 (555) 000-0001', NULL, NULL, NULL, NULL, ARRAY['Platform Management', 'User Support', 'Analytics', 'Content Moderation'], ARRAY['Education Technology', 'Career Development', 'Student Success'], true, true),

-- Company user (password: company123)
('00000000-0000-0000-0000-000000000002', 'hr@techcorp.com', '$2a$12$YrrjykXt23w23MP10eVrjufzoQbwQoc9ULIOpf3XfHm2n22NUvMRe', 'TechCorp HR Team', 'company', 'Leading technology company specializing in innovative software solutions and cutting-edge AI development.', 'San Francisco, CA', '+1 (555) 000-0002', NULL, NULL, NULL, NULL, ARRAY['Talent Acquisition', 'Employee Development', 'Technical Recruiting'], ARRAY['Technology', 'Innovation', 'Career Development'], true, true),

-- Student user (password: student123)
('00000000-0000-0000-0000-000000000003', 'john.doe@stanford.edu', '$2a$12$vagnFLrN6OE02eZD8TRxb.ha5rBN2ZHYwMybr8L5ATl7mr/EBd4nG', 'John Doe', 'student', 'Computer Science student passionate about web development and machine learning. Seeking internship opportunities to apply my skills in real-world projects.', 'Stanford, CA', '+1 (555) 000-0003', 'Stanford University', 'Computer Science', '2025', 3.8, ARRAY['React', 'TypeScript', 'Python', 'Node.js', 'Machine Learning', 'SQL', 'Git', 'AWS'], ARRAY['Web Development', 'Artificial Intelligence', 'Open Source', 'Startups', 'Technology Innovation'], true, true),

-- Additional student users
('00000000-0000-0000-0000-000000000004', 'jane.smith@mit.edu', '$2a$12$vagnFLrN6OE02eZD8TRxb.ha5rBN2ZHYwMybr8L5ATl7mr/EBd4nG', 'Jane Smith', 'student', 'Software Engineering student with a passion for mobile app development and UI/UX design.', 'Cambridge, MA', '+1 (555) 000-0004', 'MIT', 'Software Engineering', '2024', 3.9, ARRAY['React Native', 'Flutter', 'JavaScript', 'Python', 'Figma', 'Adobe XD'], ARRAY['Mobile Development', 'UI/UX Design', 'Startups'], true, true),

('00000000-0000-0000-0000-000000000005', 'mike.johnson@berkeley.edu', '$2a$12$vagnFLrN6OE02eZD8TRxb.ha5rBN2ZHYwMybr8L5ATl7mr/EBd4nG', 'Mike Johnson', 'student', 'Data Science student interested in machine learning and data analytics.', 'Berkeley, CA', '+1 (555) 000-0005', 'UC Berkeley', 'Data Science', '2025', 3.7, ARRAY['Python', 'R', 'SQL', 'TensorFlow', 'Pandas', 'Matplotlib'], ARRAY['Data Science', 'Machine Learning', 'Analytics'], true, true);

-- Insert demo companies
INSERT INTO companies (id, user_id, name, slug, description, website, industry, company_size, location, founded_year, contact_email, contact_phone, linkedin_url, status, verified) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'TechCorp Inc.', 'techcorp-inc', 'We are a leading technology company that develops innovative software solutions for businesses worldwide. Our mission is to empower organizations through cutting-edge technology and exceptional talent.', 'https://techcorp.com', 'Technology', '500-1000', 'San Francisco, CA', 2015, 'hr@techcorp.com', '+1 (555) 000-0002', 'https://linkedin.com/company/techcorp', 'active', true);

-- Insert demo internships
INSERT INTO internships (id, company_id, title, description, requirements, responsibilities, skills_required, location, location_type, duration, stipend, application_deadline, start_date, end_date, status, positions_available, positions_filled) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Frontend Developer Intern', 'Join our dynamic frontend team to build cutting-edge web applications using React and TypeScript. You will work on real projects that impact thousands of users while learning from experienced developers.', 
ARRAY['Currently pursuing a degree in Computer Science or related field', 'Strong foundation in JavaScript and HTML/CSS', 'Familiarity with React or similar frameworks', 'Good problem-solving skills', 'Excellent communication skills'], 
ARRAY['Develop and maintain frontend components using React and TypeScript', 'Collaborate with designers to implement pixel-perfect UI designs', 'Write clean, maintainable, and well-documented code', 'Participate in code reviews and team meetings', 'Learn and apply best practices in frontend development'], 
ARRAY['React', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Git'], 'San Francisco, CA', 'hybrid', '3 months', 2500, '2025-07-15 23:59:59+00', '2025-08-01 09:00:00+00', '2025-10-31 17:00:00+00', 'published', 2, 0),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Backend Developer Intern', 'Work with our backend team to build scalable APIs and microservices using Node.js and PostgreSQL. Perfect opportunity for students interested in server-side development and cloud technologies.',
ARRAY['Pursuing Computer Science or Software Engineering degree', 'Basic knowledge of server-side programming', 'Understanding of databases and SQL', 'Familiarity with RESTful APIs', 'Strong analytical thinking'],
ARRAY['Design and implement RESTful APIs using Node.js and Express', 'Work with PostgreSQL databases and write efficient queries', 'Implement authentication and authorization systems', 'Deploy applications to cloud platforms', 'Monitor and optimize application performance'],
ARRAY['Node.js', 'Express.js', 'PostgreSQL', 'REST APIs', 'AWS'], 'San Francisco, CA', 'remote', '3 months', 2800, '2025-07-20 23:59:59+00', '2025-08-15 09:00:00+00', '2025-11-15 17:00:00+00', 'published', 1, 0),

('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Data Science Intern', 'Join our data science team to work on machine learning projects and data analysis. You will gain hands-on experience with real-world datasets and cutting-edge ML techniques.',
ARRAY['Studying Data Science, Statistics, or related field', 'Proficiency in Python and data manipulation libraries', 'Understanding of statistical concepts and machine learning', 'Experience with data visualization tools', 'Strong mathematical background'],
ARRAY['Analyze large datasets to extract meaningful insights', 'Build and train machine learning models', 'Create data visualizations and reports', 'Collaborate with product teams to solve business problems', 'Present findings to stakeholders'],
ARRAY['Python', 'Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'SQL'], 'San Francisco, CA', 'onsite', '4 months', 3000, '2025-07-10 23:59:59+00', '2025-08-01 09:00:00+00', '2025-12-01 17:00:00+00', 'published', 1, 0);

-- Insert demo applications
INSERT INTO applications (id, internship_id, student_id, cover_letter, status, applied_at) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Dear TechCorp Team,

I am writing to express my strong interest in the Frontend Developer Intern position. As a Computer Science student at Stanford University with a passion for web development, I am excited about the opportunity to contribute to your innovative projects while learning from your experienced team.

My experience with React, TypeScript, and modern frontend technologies aligns perfectly with your requirements. I have built several personal projects using these technologies, including a task management application and a weather dashboard. I am particularly drawn to TechCorp''s commitment to cutting-edge technology and would love to contribute to building applications that impact thousands of users.

I am eager to bring my problem-solving skills, attention to detail, and enthusiasm for learning to your team. Thank you for considering my application.

Best regards,
John Doe', 'pending', NOW() - INTERVAL '2 days'),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'Dear Hiring Manager,

I am excited to apply for the Data Science Intern position at TechCorp. As a Data Science student at UC Berkeley, I have developed strong skills in Python, machine learning, and statistical analysis that would be valuable for this role.

Through my coursework and personal projects, I have gained experience with pandas, scikit-learn, and TensorFlow. I recently completed a project analyzing customer behavior data, where I built predictive models that achieved 85% accuracy. I am passionate about extracting insights from data and using them to solve real-world business problems.

I would welcome the opportunity to contribute to TechCorp''s data science initiatives and learn from your experienced team.

Sincerely,
Mike Johnson', 'reviewed', NOW() - INTERVAL '1 day');

-- Insert demo tasks (internship-specific tasks)
INSERT INTO tasks (id, internship_id, student_id, title, description, due_date, status) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Setup Development Environment', 'Set up your local development environment with Node.js, React, and our company''s development tools. Clone the project repository and ensure you can run the application locally.', NOW() + INTERVAL '3 days', 'assigned'),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Complete React Tutorial', 'Complete the official React tutorial and build a tic-tac-toe game. This will help you understand React fundamentals before working on our main projects.', NOW() + INTERVAL '1 week', 'assigned');

-- Insert demo admin tasks (platform-wide tasks assigned by admin)
INSERT INTO admin_tasks (id, title, description, assigned_to, assigned_by, due_date, status, priority, points, is_active) VALUES
('10000000-0000-0000-0000-000000000001', 'Complete Profile Setup', 'Complete your student profile by adding your skills, interests, and uploading a professional photo. This will help companies find you more easily.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '2 days', 'pending', 'high', 10, true),

('10000000-0000-0000-0000-000000000002', 'Take Communication Skills Course', 'Complete the Professional Communication Skills course to improve your workplace communication abilities. This is essential for internship success.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '1 week', 'pending', 'medium', 25, true),

('10000000-0000-0000-0000-000000000003', 'Submit Resume for Review', 'Upload your latest resume to the platform for admin review and feedback. Make sure it highlights your technical skills and projects.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '5 days', 'in-progress', 'medium', 15, true),

('10000000-0000-0000-0000-000000000004', 'Complete React Fundamentals Course', 'Finish the React Fundamentals course to strengthen your frontend development skills. This will prepare you for frontend internship opportunities.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days', 'completed', 'low', 30, true),

('10000000-0000-0000-0000-000000000005', 'Attend Virtual Career Fair', 'Participate in the upcoming virtual career fair to network with potential employers and learn about internship opportunities.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days', 'pending', 'high', 20, true),

-- Tasks for Jane Smith (second student)
('10000000-0000-0000-0000-000000000006', 'Complete Profile Setup', 'Complete your student profile by adding your skills, interests, and uploading a professional photo.', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '3 days', 'completed', 'high', 10, true),

('10000000-0000-0000-0000-000000000007', 'UI/UX Design Portfolio Review', 'Submit your UI/UX design portfolio for review and feedback. Include your best mobile app designs and user interface work.', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '1 week', 'in-progress', 'medium', 25, true),

-- Tasks for Mike Johnson (third student)
('10000000-0000-0000-0000-000000000008', 'Data Science Project Submission', 'Submit your data science capstone project demonstrating your skills in Python, machine learning, and data visualization.', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '4 days', 'pending', 'high', 35, true),

('10000000-0000-0000-0000-000000000009', 'Complete Python Data Science Course', 'Finish the Data Science with Python course to enhance your analytical skills and prepare for data science internships.', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', 'completed', 'medium', 40, true),

-- An overdue task for testing
('10000000-0000-0000-0000-000000000010', 'Submit Weekly Progress Report', 'Submit your weekly progress report detailing your learning activities and internship search progress.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 'pending', 'medium', 5, true);

-- Insert demo messages
INSERT INTO messages (id, sender_id, recipient_id, subject, content) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Welcome to TechCorp!', 'Hi John,

Welcome to the TechCorp internship program! We are excited to have you join our team. Your first day will be on August 1st, and we will start with an orientation session at 9:00 AM.

Please make sure to complete the setup tasks assigned to you before your start date. If you have any questions, feel free to reach out.

Best regards,
TechCorp HR Team'),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Platform Updates', 'Dear TechCorp Team,

We have made several updates to the internship platform to improve user experience. Please review the new features and let us know if you have any feedback.

Best regards,
Admin Team');

-- Insert demo courses
INSERT INTO courses (id, title, description, category, level, duration, lessons, instructor, thumbnail, course_url, youtube_url, skills, is_active, certificate, created_by) VALUES
('00000000-0000-0000-0000-000000000001', 'React Fundamentals for Beginners', 'Learn the basics of React including components, props, state, and hooks. Perfect for beginners who want to start their journey in modern web development.', 'Frontend Development', 'beginner', '4 hours', 12, 'Sarah Johnson', 'https://images.pexels.com/photos/11035380/pexels-photo-11035380.jpeg?auto=compress&cs=tinysrgb&w=400', '/courses/react-fundamentals', 'https://www.youtube.com/embed/Tn6-PIqc4UM', ARRAY['React', 'JavaScript', 'JSX', 'Components'], true, true, '00000000-0000-0000-0000-000000000001'),

('00000000-0000-0000-0000-000000000002', 'Advanced TypeScript Patterns', 'Master advanced TypeScript concepts including generics, decorators, and design patterns. Take your TypeScript skills to the next level.', 'Frontend Development', 'advanced', '6 hours', 18, 'Michael Chen', 'https://images.pexels.com/photos/4164418/pexels-photo-4164418.jpeg?auto=compress&cs=tinysrgb&w=400', '/courses/advanced-typescript', 'https://www.youtube.com/embed/BwuLxPH8IDs', ARRAY['TypeScript', 'Design Patterns', 'Advanced JavaScript'], true, true, '00000000-0000-0000-0000-000000000001'),

('00000000-0000-0000-0000-000000000003', 'Node.js Backend Development', 'Build scalable backend applications with Node.js, Express, and PostgreSQL. Learn API development, authentication, and deployment.', 'Backend Development', 'intermediate', '8 hours', 24, 'David Rodriguez', 'https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg?auto=compress&cs=tinysrgb&w=400', '/courses/nodejs-backend', 'https://www.youtube.com/embed/fBNz5xF-Kx4', ARRAY['Node.js', 'Express', 'PostgreSQL', 'REST APIs'], true, true, '00000000-0000-0000-0000-000000000001'),

('00000000-0000-0000-0000-000000000004', 'Data Science with Python', 'Learn data analysis, visualization, and machine learning with Python. Perfect for students interested in data science careers.', 'Data Science', 'intermediate', '10 hours', 30, 'Dr. Emily Watson', 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=400', '/courses/data-science-python', 'https://www.youtube.com/embed/LHBE6Q9XlzI', ARRAY['Python', 'Pandas', 'NumPy', 'Machine Learning', 'Data Visualization'], true, true, '00000000-0000-0000-0000-000000000001'),

('00000000-0000-0000-0000-000000000005', 'Professional Communication Skills', 'Develop essential communication skills for the workplace including presentations, meetings, and written communication.', 'Soft Skills', 'beginner', '3 hours', 8, 'Lisa Thompson', 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400', '/courses/communication-skills', 'https://www.youtube.com/embed/HAnw168huqA', ARRAY['Communication', 'Presentation', 'Professional Skills'], true, true, '00000000-0000-0000-0000-000000000001');

-- Insert demo course lessons
INSERT INTO course_lessons (id, course_id, title, description, duration, order_index) VALUES
-- React Fundamentals lessons
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Introduction to React', 'Overview of React and its ecosystem', '15 min', 1),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Setting up Development Environment', 'Installing Node.js, npm, and creating a React app', '20 min', 2),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Your First Component', 'Creating and rendering your first React component', '25 min', 3),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Props and State', 'Understanding component props and state management', '30 min', 4),

-- TypeScript lessons
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Advanced Generics', 'Master generic types and constraints', '25 min', 1),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'Decorators and Metadata', 'Understanding decorators and reflection', '30 min', 2),

-- Node.js lessons
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 'Express.js Fundamentals', 'Building REST APIs with Express', '35 min', 1),
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'Database Integration', 'Connecting to PostgreSQL database', '40 min', 2);