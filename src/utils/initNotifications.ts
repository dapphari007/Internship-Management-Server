import pool from '../config/database.js';

export async function initializeNotificationsTable() {
  try {
    console.log('Initializing notifications table...');
    
    // Create the notifications table
    await pool.query(`
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
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
    `);

    // Create trigger function if it doesn't exist
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Add trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
    `);
    
    await pool.query(`
      CREATE TRIGGER update_notifications_updated_at 
          BEFORE UPDATE ON notifications 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Notifications table initialized successfully');
    
    // Add some sample notifications
    await createSampleNotifications();
    
  } catch (error) {
    console.error('❌ Error initializing notifications table:', error);
    throw error;
  }
}

async function createSampleNotifications() {
  try {
    console.log('Creating sample notifications...');
    
    // Get some users to create notifications for
    const usersResult = await pool.query('SELECT id, role FROM users LIMIT 10');
    const users = usersResult.rows;
    
    if (users.length === 0) {
      console.log('No users found, skipping sample notifications');
      return;
    }

    for (const user of users) {
      // Check if user already has notifications
      const existingNotifications = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
        [user.id]
      );
      
      if (parseInt(existingNotifications.rows[0].count) > 0) {
        continue; // Skip if user already has notifications
      }

      // Create welcome notification
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, type, action_url) 
        VALUES ($1, $2, $3, $4, $5)
      `, [
        user.id,
        'Welcome to the Platform! 🎉',
        'Thank you for joining our internship platform. Start exploring opportunities today!',
        'success',
        user.role === 'student' ? '/internships' : '/dashboard'
      ]);

      // Create role-specific notifications
      if (user.role === 'student') {
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, type, action_url) 
          VALUES ($1, $2, $3, $4, $5)
        `, [
          user.id,
          'Complete Your Profile',
          'Complete your profile to get better internship recommendations and increase your chances of getting hired.',
          'info',
          '/profile'
        ]);
        
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, type) 
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'New Internships Available',
          'Check out the latest internship opportunities that match your skills and interests.',
          'info'
        ]);
      } else if (user.role === 'company') {
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, type, action_url) 
          VALUES ($1, $2, $3, $4, $5)
        `, [
          user.id,
          'Post Your First Internship',
          'Start attracting talented students by posting your first internship opportunity.',
          'info',
          '/post-internship'
        ]);
        
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, type, action_url) 
          VALUES ($1, $2, $3, $4, $5)
        `, [
          user.id,
          'New Application Received',
          'You have received a new application for your internship posting. Review it now!',
          'success',
          '/applications'
        ]);
      }
    }
    
    console.log('✅ Sample notifications created successfully');
    
  } catch (error) {
    console.error('❌ Error creating sample notifications:', error);
  }
}

// Function to check if notifications table exists
export async function checkNotificationsTable() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking notifications table:', error);
    return false;
  }
}