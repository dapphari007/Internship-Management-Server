const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'internship_platform',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function setupAdminTasks() {
  try {
    console.log('Setting up admin_tasks table...');
    
    // Read and execute the admin_tasks migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_admin_tasks.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    console.log('✅ admin_tasks table created successfully');
    
    // Check if we need to add sample data
    const result = await pool.query('SELECT COUNT(*) FROM admin_tasks');
    const count = parseInt(result.rows[0].count);
    
    if (count === 0) {
      console.log('Adding sample admin_tasks data...');
      
      // Add sample admin tasks
      const sampleTasksSQL = `
        INSERT INTO admin_tasks (id, title, description, assigned_to, assigned_by, due_date, status, priority, points, is_active) VALUES
        ('10000000-0000-0000-0000-000000000001', 'Complete Profile Setup', 'Complete your student profile by adding your skills, interests, and uploading a professional photo. This will help companies find you more easily.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '2 days', 'pending', 'high', 10, true),
        ('10000000-0000-0000-0000-000000000002', 'Take Communication Skills Course', 'Complete the Professional Communication Skills course to improve your workplace communication abilities. This is essential for internship success.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '1 week', 'pending', 'medium', 25, true),
        ('10000000-0000-0000-0000-000000000003', 'Submit Resume for Review', 'Upload your latest resume to the platform for admin review and feedback. Make sure it highlights your technical skills and projects.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '5 days', 'in-progress', 'medium', 15, true),
        ('10000000-0000-0000-0000-000000000004', 'Complete React Fundamentals Course', 'Finish the React Fundamentals course to strengthen your frontend development skills. This will prepare you for frontend internship opportunities.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days', 'completed', 'low', 30, true),
        ('10000000-0000-0000-0000-000000000005', 'Attend Virtual Career Fair', 'Participate in the upcoming virtual career fair to network with potential employers and learn about internship opportunities.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days', 'pending', 'high', 20, true),
        ('10000000-0000-0000-0000-000000000010', 'Submit Weekly Progress Report', 'Submit your weekly progress report detailing your learning activities and internship search progress.', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 'pending', 'medium', 5, true)
        ON CONFLICT (id) DO NOTHING;
      `;
      
      await pool.query(sampleTasksSQL);
      console.log('✅ Sample admin_tasks data added successfully');
    } else {
      console.log(`ℹ️  admin_tasks table already has ${count} records`);
    }
    
    // Verify the setup
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
      FROM admin_tasks
    `);
    
    const stats = verifyResult.rows[0];
    console.log('\n📊 Admin Tasks Summary:');
    console.log(`   Total: ${stats.total_tasks}`);
    console.log(`   Pending: ${stats.pending_tasks}`);
    console.log(`   In Progress: ${stats.in_progress_tasks}`);
    console.log(`   Completed: ${stats.completed_tasks}`);
    
    console.log('\n✅ Admin tasks setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up admin_tasks:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupAdminTasks();