#!/usr/bin/env node

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Create database connection using production DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedProductionData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting production database seeding...');
    
    await client.query('BEGIN');
    
    // Hash passwords
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const companyPasswordHash = await bcrypt.hash('company123', 12);
    const studentPasswordHash = await bcrypt.hash('student123', 12);
    
    // Generate UUIDs
    const adminId = '00000000-0000-0000-0000-000000000001';
    const companyId = '00000000-0000-0000-0000-000000000002';
    const student1Id = '00000000-0000-0000-0000-000000000003';
    const student2Id = '00000000-0000-0000-0000-000000000004';
    const student3Id = '00000000-0000-0000-0000-000000000005';
    const companyProfileId = '00000000-0000-0000-0000-000000000001';
    const internship1Id = '00000000-0000-0000-0000-000000000001';
    const internship2Id = '00000000-0000-0000-0000-000000000002';
    const internship3Id = '00000000-0000-0000-0000-000000000003';
    
    // Insert users
    await client.query(`
      INSERT INTO users (id, email, password_hash, full_name, role, bio, location, phone, university, major, graduation_year, gpa, skills, interests, profile_complete, verified, profile_completion_percentage) VALUES
      ($1, 'admin@internshippro.com', $2, 'System Administrator', 'admin', 'Platform administrator with full access to manage users, content, and system settings.', 'San Francisco, CA', '+1 (555) 000-0001', NULL, NULL, NULL, NULL, ARRAY['Platform Management', 'User Support', 'Analytics', 'Content Moderation'], ARRAY['Education Technology', 'Career Development', 'Student Success'], true, true, 100),
      ($3, 'hr@techcorp.com', $4, 'TechCorp HR Team', 'company', 'Leading technology company specializing in innovative software solutions and cutting-edge AI development.', 'San Francisco, CA', '+1 (555) 000-0002', NULL, NULL, NULL, NULL, ARRAY['Talent Acquisition', 'Employee Development', 'Technical Recruiting'], ARRAY['Technology', 'Innovation', 'Career Development'], true, true, 90),
      ($5, 'john.doe@stanford.edu', $6, 'John Doe', 'student', 'Computer Science student passionate about web development and machine learning. Seeking internship opportunities to apply my skills in real-world projects.', 'Stanford, CA', '+1 (555) 000-0003', 'Stanford University', 'Computer Science', '2025', 3.8, ARRAY['React', 'TypeScript', 'Python', 'Node.js', 'Machine Learning', 'SQL', 'Git', 'AWS'], ARRAY['Web Development', 'Artificial Intelligence', 'Open Source', 'Startups', 'Technology Innovation'], true, true, 95),
      ($7, 'jane.smith@mit.edu', $8, 'Jane Smith', 'student', 'Software Engineering student with a passion for mobile app development and UI/UX design.', 'Cambridge, MA', '+1 (555) 000-0004', 'MIT', 'Software Engineering', '2024', 3.9, ARRAY['React Native', 'Flutter', 'JavaScript', 'Python', 'Figma', 'Adobe XD'], ARRAY['Mobile Development', 'UI/UX Design', 'Startups'], true, true, 88),
      ($9, 'mike.johnson@berkeley.edu', $10, 'Mike Johnson', 'student', 'Data Science student interested in machine learning and data analytics.', 'Berkeley, CA', '+1 (555) 000-0005', 'UC Berkeley', 'Data Science', '2025', 3.7, ARRAY['Python', 'R', 'SQL', 'TensorFlow', 'Pandas', 'Matplotlib'], ARRAY['Data Science', 'Machine Learning', 'Analytics'], true, true, 82)
      ON CONFLICT (id) DO NOTHING
    `, [adminId, adminPasswordHash, companyId, companyPasswordHash, student1Id, studentPasswordHash, student2Id, studentPasswordHash, student3Id, studentPasswordHash]);
    
    // Insert companies
    await client.query(`
      INSERT INTO companies (id, user_id, name, slug, description, website, industry, company_size, location, founded_year, contact_email, contact_phone, linkedin_url, status, verified) VALUES
      ($1, $2, 'TechCorp Inc.', 'techcorp-inc', 'We are a leading technology company that develops innovative software solutions for businesses worldwide. Our mission is to empower organizations through cutting-edge technology and exceptional talent.', 'https://techcorp.com', 'Technology', '500-1000', 'San Francisco, CA', 2015, 'hr@techcorp.com', '+1 (555) 000-0002', 'https://linkedin.com/company/techcorp', 'active', true)
      ON CONFLICT (id) DO NOTHING
    `, [companyProfileId, companyId]);
    
    // Insert internships
    await client.query(`
      INSERT INTO internships (id, company_id, title, description, requirements, responsibilities, skills_required, location, location_type, duration, stipend, application_deadline, start_date, end_date, status, positions_available, positions_filled) VALUES
      ($1, $2, 'Frontend Developer Intern', 'Join our dynamic frontend team to build cutting-edge web applications using React and TypeScript. You will work on real projects that impact thousands of users while learning from experienced developers.', 
      ARRAY['Currently pursuing a degree in Computer Science or related field', 'Strong foundation in JavaScript and HTML/CSS', 'Familiarity with React or similar frameworks', 'Good problem-solving skills', 'Excellent communication skills'], 
      ARRAY['Develop and maintain frontend components using React and TypeScript', 'Collaborate with designers to implement pixel-perfect UI designs', 'Write clean, maintainable, and well-documented code', 'Participate in code reviews and team meetings', 'Learn and apply best practices in frontend development'], 
      ARRAY['React', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Git'], 'San Francisco, CA', 'hybrid', '3 months', 2500, '2025-07-15 23:59:59+00', '2025-08-01 09:00:00+00', '2025-10-31 17:00:00+00', 'published', 2, 0),
      
      ($3, $2, 'Backend Developer Intern', 'Work with our backend team to build scalable APIs and microservices using Node.js and PostgreSQL. Perfect opportunity for students interested in server-side development and cloud technologies.',
      ARRAY['Pursuing Computer Science or Software Engineering degree', 'Basic knowledge of server-side programming', 'Understanding of databases and SQL', 'Familiarity with RESTful APIs', 'Strong analytical thinking'],
      ARRAY['Design and implement RESTful APIs using Node.js and Express', 'Work with PostgreSQL databases and write efficient queries', 'Implement authentication and authorization systems', 'Deploy applications to cloud platforms', 'Monitor and optimize application performance'],
      ARRAY['Node.js', 'Express.js', 'PostgreSQL', 'REST APIs', 'AWS'], 'San Francisco, CA', 'remote', '3 months', 2800, '2025-07-20 23:59:59+00', '2025-08-15 09:00:00+00', '2025-11-15 17:00:00+00', 'published', 1, 0),
      
      ($4, $2, 'Data Science Intern', 'Join our data science team to work on machine learning projects and data analysis. You will gain hands-on experience with real-world datasets and cutting-edge ML techniques.',
      ARRAY['Studying Data Science, Statistics, or related field', 'Proficiency in Python and data manipulation libraries', 'Understanding of statistical concepts and machine learning', 'Experience with data visualization tools', 'Strong mathematical background'],
      ARRAY['Analyze large datasets to extract meaningful insights', 'Build and train machine learning models', 'Create data visualizations and reports', 'Collaborate with product teams to solve business problems', 'Present findings to stakeholders'],
      ARRAY['Python', 'Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'SQL'], 'San Francisco, CA', 'onsite', '4 months', 3000, '2025-07-10 23:59:59+00', '2025-08-01 09:00:00+00', '2025-12-01 17:00:00+00', 'published', 1, 0)
      ON CONFLICT (id) DO NOTHING
    `, [internship1Id, companyProfileId, internship2Id, internship3Id]);
    
    // Insert sample applications
    await client.query(`
      INSERT INTO applications (id, internship_id, student_id, cover_letter, status, applied_at) VALUES
      ($1, $2, $3, 'Dear TechCorp Team, I am writing to express my strong interest in the Frontend Developer Intern position. As a Computer Science student at Stanford University with a passion for web development, I am excited about the opportunity to contribute to your innovative projects while learning from your experienced team.', 'pending', NOW()),
      ($4, $5, $6, 'Dear Hiring Manager, I am very interested in the Backend Developer Intern position at TechCorp. My experience with Node.js and databases makes me a great fit for this role.', 'reviewed', NOW()),
      ($7, $8, $9, 'Hello TechCorp Team, I would love to join your data science team as an intern. My background in statistics and machine learning aligns perfectly with this opportunity.', 'shortlisted', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [uuidv4(), internship1Id, student1Id, uuidv4(), internship2Id, student2Id, uuidv4(), internship3Id, student3Id]);
    
    // Insert sample tasks (using the original schema columns)
    await client.query(`
      INSERT INTO tasks (id, internship_id, student_id, title, description, due_date, status, created_at, updated_at) VALUES
      ($1, $2, $3, 'Complete React Dashboard', 'Build a responsive dashboard using React and TypeScript with charts and data visualization components.', '2025-07-15 23:59:59+00', 'assigned', NOW(), NOW()),
      ($4, $5, $6, 'API Integration Task', 'Integrate the frontend with the backend API endpoints and handle error cases gracefully.', '2025-07-20 23:59:59+00', 'in_progress', NOW(), NOW()),
      ($7, $8, $9, 'Database Design Project', 'Design and implement a database schema for the internship management system.', '2025-07-25 23:59:59+00', 'assigned', NOW(), NOW()),
      ($10, $11, $12, 'Data Analysis Report', 'Analyze user engagement data and create a comprehensive report with visualizations.', '2025-07-30 23:59:59+00', 'assigned', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      uuidv4(), internship1Id, student1Id,
      uuidv4(), internship2Id, student2Id, 
      uuidv4(), internship3Id, student3Id,
      uuidv4(), internship1Id, student2Id
    ]);
    
    await client.query('COMMIT');
    
    console.log('✅ Production database seeding completed successfully!');
    console.log('\n🔐 Test User Credentials:');
    console.log('-----------------------------------');
    console.log('Admin User:');
    console.log('  Email: admin@internshippro.com');
    console.log('  Password: admin123');
    console.log('');
    console.log('Company User:');
    console.log('  Email: hr@techcorp.com');
    console.log('  Password: company123');
    console.log('');
    console.log('Student Users:');
    console.log('  Email: john.doe@stanford.edu');
    console.log('  Password: student123');
    console.log('  Email: jane.smith@mit.edu');
    console.log('  Password: student123');
    console.log('  Email: mike.johnson@berkeley.edu');
    console.log('  Password: student123');
    console.log('-----------------------------------');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding production database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seedProductionData()
  .then(() => {
    console.log('🎉 Production seeding process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Production seeding failed:', error.message);
    process.exit(1);
  });
