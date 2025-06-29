import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'internship_management',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function setupNotifications() {
  try {
    console.log('🔄 Setting up notifications table...');
    
    // Read and execute the migration file
    const migrationPath = join(__dirname, '..', 'database', 'migrations', 'create_notifications_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Notifications table created successfully!');
    
    // Insert some sample notifications for testing
    console.log('🔄 Inserting sample notifications...');
    
    // Get a sample user ID (assuming there's at least one user)
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      const sampleNotifications = [
        {
          title: 'Welcome to InternshipPro! 🎉',
          message: 'Your account has been successfully created. Start exploring internship opportunities now!',
          type: 'success',
          action_url: '/internships'
        },
        {
          title: 'Complete Your Profile',
          message: 'Complete your profile to get better internship recommendations.',
          type: 'info',
          action_url: '/profile'
        },
        {
          title: 'New Feature Available',
          message: 'Check out our new global search feature to find internships, tasks, and more!',
          type: 'info',
          action_url: '/dashboard'
        }
      ];
      
      for (const notification of sampleNotifications) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, action_url, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [userId, notification.title, notification.message, notification.type, notification.action_url]
        );
      }
      
      console.log('✅ Sample notifications inserted successfully!');
    } else {
      console.log('⚠️  No users found, skipping sample notifications');
    }
    
  } catch (error) {
    console.error('❌ Error setting up notifications:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupNotifications();