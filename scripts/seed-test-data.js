#!/usr/bin/env node

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Create database connection
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' 
          ? { rejectUnauthorized: false } 
          : false,
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'internship_platform',
        password: process.env.DB_PASSWORD || 'admin',
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: false,
      }
);

async function seedTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting test data seeding...');
    
    await client.query('BEGIN');
    
    // Insert test users with ON CONFLICT handling
    console.log('👥 Inserting test users...');
    
    const users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@internshippro.com',
        password_hash: '$2a$12$ESubmzdUAMHYDQBFPplRO.62PJAuVzQMtoFTb63jNfstP6OfKk2/W', // admin123
        full_name: 'System Administrator',
        role: 'admin',
        bio: 'Platform administrator with full access to manage users, content, and system settings.',
        location: 'San Francisco, CA',
        phone: '+1 (555) 000-0001'
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'hr@techcorp.com',
        password_hash: '$2a$12$YrrjykXt23w23MP10eVrjufzoQbwQoc9ULIOpf3XfHm2n22NUvMRe', // company123
        full_name: 'TechCorp HR Team',
        role: 'company',
        bio: 'Leading technology company specializing in innovative software solutions and cutting-edge AI development.',
        location: 'San Francisco, CA',
        phone: '+1 (555) 000-0002'
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        email: 'john.doe@stanford.edu',
        password_hash: '$2a$12$vagnFLrN6OE02eZD8TRxb.ha5rBN2ZHYwMybr8L5ATl7mr/EBd4nG', // student123
        full_name: 'John Doe',
        role: 'student',
        bio: 'Computer Science student passionate about web development and machine learning.',
        location: 'Stanford, CA',
        phone: '+1 (555) 000-0003',
        university: 'Stanford University',
        major: 'Computer Science',
        graduation_year: '2025',
        gpa: 3.8
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        email: 'jane.smith@mit.edu',
        password_hash: '$2a$12$vagnFLrN6OE02eZD8TRxb.ha5rBN2ZHYwMybr8L5ATl7mr/EBd4nG', // student123
        full_name: 'Jane Smith',
        role: 'student',
        bio: 'Software Engineering student with a passion for mobile app development and UI/UX design.',
        location: 'Cambridge, MA',
        phone: '+1 (555) 000-0004',
        university: 'MIT',
        major: 'Software Engineering',
        graduation_year: '2024',
        gpa: 3.9
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        email: 'mike.johnson@berkeley.edu',
        password_hash: '$2a$12$vagnFLrN6OE02eZD8TRxb.ha5rBN2ZHYwMybr8L5ATl7mr/EBd4nG', // student123
        full_name: 'Mike Johnson',
        role: 'student',
        bio: 'Data Science student interested in machine learning and data analytics.',
        location: 'Berkeley, CA',
        phone: '+1 (555) 000-0005',
        university: 'UC Berkeley',
        major: 'Data Science',
        graduation_year: '2025',
        gpa: 3.7
      }
    ];
    
    for (const user of users) {
      await client.query(`
        INSERT INTO users (
          id, email, password_hash, full_name, role, bio, location, phone, 
          university, major, graduation_year, gpa, profile_complete, verified
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, true
        ) ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          bio = EXCLUDED.bio,
          location = EXCLUDED.location,
          phone = EXCLUDED.phone,
          university = EXCLUDED.university,
          major = EXCLUDED.major,
          graduation_year = EXCLUDED.graduation_year,
          gpa = EXCLUDED.gpa
      `, [
        user.id, user.email, user.password_hash, user.full_name, user.role,
        user.bio, user.location, user.phone, user.university || null,
        user.major || null, user.graduation_year || null, user.gpa || null
      ]);
    }
    
    console.log('✅ Test users inserted/updated successfully');
    
    // Insert test company
    console.log('🏢 Inserting test company...');
    await client.query(`
      INSERT INTO companies (
        id, user_id, name, slug, description, website, industry, 
        company_size, location, founded_year, contact_email, contact_phone, 
        linkedin_url, status, verified
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'TechCorp Inc.',
        'techcorp-inc',
        'Leading technology company that develops innovative software solutions for businesses worldwide.',
        'https://techcorp.com',
        'Technology',
        '500-1000',
        'San Francisco, CA',
        2015,
        'hr@techcorp.com',
        '+1 (555) 000-0002',
        'https://linkedin.com/company/techcorp',
        'active',
        true
      ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        website = EXCLUDED.website,
        industry = EXCLUDED.industry,
        company_size = EXCLUDED.company_size,
        location = EXCLUDED.location
    `);
    
    console.log('✅ Test company inserted/updated successfully');
    
    await client.query('COMMIT');
    
    console.log('🎉 Test data seeding completed successfully!');
    
    // Display test credentials
    console.log('\n🔐 Test User Credentials:');
    console.log('═══════════════════════════════════════');
    console.log('🔑 Admin User:');
    console.log('   Email: admin@internshippro.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('🏢 Company User:');
    console.log('   Email: hr@techcorp.com');
    console.log('   Password: company123');
    console.log('');
    console.log('🎓 Student Users:');
    console.log('   Email: john.doe@stanford.edu');
    console.log('   Password: student123');
    console.log('   ');
    console.log('   Email: jane.smith@mit.edu');
    console.log('   Password: student123');
    console.log('   ');
    console.log('   Email: mike.johnson@berkeley.edu');
    console.log('   Password: student123');
    console.log('═══════════════════════════════════════');
    console.log('⚠️  SECURITY WARNING: Change these passwords in production!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seedTestData()
  .then(() => {
    console.log('\n🚀 Database seeding process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error.message);
    process.exit(1);
  });
