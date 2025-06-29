// Setup script to ensure courses database tables are properly configured
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
  password: process.env.DB_PASSWORD || 'admin',
  port: process.env.DB_PORT || 5432,
});

async function setupCoursesDatabase() {
  try {
    console.log('🔧 Setting up courses database tables...');

    // Read and execute the fix courses schema migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'fix_courses_schema.sql');
    
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log('📄 Executing courses schema fix migration...');
      await pool.query(migrationSQL);
      console.log('✅ Courses schema fix migration completed');
    } else {
      console.log('⚠️  Migration file not found, creating tables manually...');
      
      // Create tables manually if migration file doesn't exist
      const createTablesSQL = `
        -- Ensure courses table has all required columns
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_url TEXT;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS youtube_url TEXT;

        -- Ensure course_enrollments table exists
        CREATE TABLE IF NOT EXISTS course_enrollments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE,
            progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
            is_completed BOOLEAN DEFAULT FALSE,
            UNIQUE(course_id, student_id)
        );

        -- Ensure course_lessons table exists
        CREATE TABLE IF NOT EXISTS course_lessons (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            duration VARCHAR(20) NOT NULL,
            order_index INTEGER NOT NULL,
            content_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes if they don't exist
        CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
        CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON course_enrollments(student_id);
        CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON course_lessons(course_id);
        CREATE INDEX IF NOT EXISTS idx_course_lessons_order ON course_lessons(course_id, order_index);
      `;
      
      await pool.query(createTablesSQL);
      console.log('✅ Tables created manually');
    }

    // Test the courses table structure
    console.log('🔍 Checking courses table structure...');
    const tableInfoQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'courses'
      ORDER BY ordinal_position;
    `;
    
    const tableInfo = await pool.query(tableInfoQuery);
    console.log('📋 Courses table columns:');
    tableInfo.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Test a simple query
    console.log('🧪 Testing courses query...');
    const testQuery = `
      SELECT 
        id, title, description, category, level, 
        course_url, youtube_url, is_active
      FROM courses 
      LIMIT 3
    `;
    
    const testResult = await pool.query(testQuery);
    console.log(`✅ Query test successful - found ${testResult.rows.length} courses`);
    
    if (testResult.rows.length > 0) {
      console.log('📚 Sample course data:');
      testResult.rows.forEach(course => {
        console.log(`  - ${course.title} (${course.category}, ${course.level})`);
        console.log(`    Active: ${course.is_active}, Course URL: ${course.course_url || 'N/A'}`);
      });
    }

    console.log('🎉 Courses database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up courses database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the setup
setupCoursesDatabase().catch(console.error);