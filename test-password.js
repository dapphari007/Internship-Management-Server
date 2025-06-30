import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'internship_platform',
  password: process.env.DB_PASSWORD || 'admin',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: false,
});

async function testPassword() {
  try {
    const result = await pool.query('SELECT email, password_hash FROM users WHERE email = $1', ['admin@internshippro.com']);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('Testing password for:', user.email);
      console.log('Stored hash:', user.password_hash);
      
      // Test password 'admin123'
      const isValid = await bcrypt.compare('admin123', user.password_hash);
      console.log('Password admin123 is valid:', isValid);
      
      // Also test other common passwords
      const testPasswords = ['admin', 'password', 'admin1234', '123456'];
      for (const pwd of testPasswords) {
        const valid = await bcrypt.compare(pwd, user.password_hash);
        console.log(`Password '${pwd}' is valid:`, valid);
      }
    } else {
      console.log('User not found');
    }
    
    // Test another user
    const result2 = await pool.query('SELECT email, password_hash FROM users WHERE email = $1', ['john.doe@stanford.edu']);
    if (result2.rows.length > 0) {
      const user2 = result2.rows[0];
      console.log('\nTesting password for:', user2.email);
      const isValid2 = await bcrypt.compare('student123', user2.password_hash);
      console.log('Password student123 is valid:', isValid2);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

testPassword();
