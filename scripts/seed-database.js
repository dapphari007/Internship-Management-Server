#!/usr/bin/env node

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

async function runSeed() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seeding...');
    
    // Determine which seed file to use
    const seedFile = process.argv.includes('--production') 
      ? 'seed-production.sql' 
      : 'seed.sql';
    
    const seedPath = path.join(__dirname, '..', 'database', seedFile);
    
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found: ${seedPath}`);
    }
    
    console.log(`📁 Using seed file: ${seedFile}`);
    
    // Read the seed file
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    
    // Add ON CONFLICT clauses to handle existing data
    let modifiedSeedSQL = seedSQL;
    
    // Split into individual INSERT statements and add ON CONFLICT
    const insertStatements = modifiedSeedSQL.split(/INSERT INTO/g);
    modifiedSeedSQL = insertStatements[0]; // Keep everything before first INSERT
    
    for (let i = 1; i < insertStatements.length; i++) {
      const statement = insertStatements[i];
      // Add INSERT back and add ON CONFLICT before the semicolon
      const insertStatement = 'INSERT INTO' + statement;
      const modifiedStatement = insertStatement.replace(/;(?=\s*(?:INSERT|$))/g, ' ON CONFLICT (id) DO NOTHING;');
      modifiedSeedSQL += modifiedStatement;
    }
    
    // Execute the seed SQL
    await client.query('BEGIN');
    await client.query(modifiedSeedSQL);
    await client.query('COMMIT');
    
    console.log('✅ Database seeding completed successfully!');
    
    // Display test credentials if using development seed
    if (seedFile === 'seed.sql') {
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
      console.log('⚠️  Remember to change passwords in production!');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Database Seeding Script');
  console.log('');
  console.log('Usage:');
  console.log('  node seed-database.js              # Run development seed (with test data)');
  console.log('  node seed-database.js --production # Run production seed (minimal data)');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DATABASE_URL  - Full database connection string (for production)');
  console.log('  DB_HOST       - Database host (for development)');
  console.log('  DB_USER       - Database user (for development)');
  console.log('  DB_PASSWORD   - Database password (for development)');
  console.log('  DB_NAME       - Database name (for development)');
  console.log('  DB_PORT       - Database port (for development)');
  process.exit(0);
}

// Run the seeding
runSeed()
  .then(() => {
    console.log('🎉 Seeding process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error.message);
    process.exit(1);
  });
