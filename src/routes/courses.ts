import express from 'express';
import type { Response } from 'express';
import pool from '../config/database.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import type { 
  Course, 
  CourseLesson, 
  CourseEnrollment, 
  CreateCourseData, 
  UpdateCourseData,
  CreateLessonData,
  CourseWithProgress,
  CourseCertificate
} from '../models/Course.js';

const router = express.Router();

// Helper function to safely extract error properties
const getErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return {
    message: String(error),
    stack: undefined,
    code: undefined
  };
};

// Get all courses (with enrollment info for students)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Courses API called by user:', req.user?.email, 'role:', req.user?.role);
    const { category, level, search, is_active } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // First, let's try a simpler query to ensure basic functionality works
    let baseQuery = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.duration,
        c.lessons,
        c.instructor,
        c.thumbnail,
        c.course_url as "courseUrl",
        c.youtube_url as "youtubeUrl",
        c.skills,
        c.is_active as "isActive",
        c.certificate,
        c.created_at,
        c.updated_at,
        4.5 as rating
      FROM courses c
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // For non-admin users, only show active courses
    if (userRole !== 'admin') {
      baseQuery += ` AND c.is_active = $${paramIndex}`;
      params.push(true);
      paramIndex++;
    }

    if (category) {
      baseQuery += ` AND c.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (level) {
      baseQuery += ` AND c.level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    if (search) {
      baseQuery += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== undefined && userRole === 'admin') {
      baseQuery += ` AND c.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    baseQuery += ` ORDER BY c.created_at DESC`;

    console.log('Executing base query:', baseQuery);
    console.log('With params:', params);
    
    const result = await pool.query(baseQuery, params);
    console.log('Base query result:', result.rows.length, 'courses found');
    
    // Now add enrollment information for students
    const courses = result.rows;
    
    if (userRole === 'student' && userId && courses.length > 0) {
      try {
        // Get enrollment information for all courses at once
        const courseIds = courses.map(c => c.id);
        const enrollmentQuery = `
          SELECT 
            course_id,
            CASE WHEN id IS NOT NULL THEN true ELSE false END as "isEnrolled",
            COALESCE(is_completed, false) as "isCompleted",
            COALESCE(progress, 0) as progress
          FROM course_enrollments 
          WHERE course_id = ANY($1) AND student_id = $2
        `;
        
        const enrollmentResult = await pool.query(enrollmentQuery, [courseIds, userId]);
        const enrollmentMap = new Map();
        
        enrollmentResult.rows.forEach(row => {
          enrollmentMap.set(row.course_id, {
            isEnrolled: row.isEnrolled,
            isCompleted: row.isCompleted,
            progress: row.progress
          });
        });
        
        // Add enrollment info to courses
        courses.forEach(course => {
          const enrollment = enrollmentMap.get(course.id);
          course.isEnrolled = enrollment?.isEnrolled || false;
          course.isCompleted = enrollment?.isCompleted || false;
          course.progress = enrollment?.progress || 0;
          course.enrolled = 0; // We'll calculate this separately if needed
        });
        
      } catch (enrollmentError) {
        console.warn('Error fetching enrollment data:', enrollmentError);
        // Continue without enrollment data rather than failing completely
        courses.forEach(course => {
          course.isEnrolled = false;
          course.isCompleted = false;
          course.progress = 0;
          course.enrolled = 0;
        });
      }
    } else {
      // For non-students, set default values
      courses.forEach(course => {
        course.isEnrolled = false;
        course.isCompleted = false;
        course.progress = 0;
        course.enrolled = 0;
      });
    }

    res.json(courses);
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    console.error('Error fetching courses:', error);
    console.error('Error details:', errorDetails);
    res.status(500).json({ 
      error: 'Failed to fetch courses',
      details: process.env.NODE_ENV === 'development' ? errorDetails.message : undefined
    });
  }
});

// Get single course with lessons
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Get course basic info first
    const courseQuery = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.duration,
        c.lessons,
        c.instructor,
        c.thumbnail,
        c.course_url as "courseUrl",
        c.youtube_url as "youtubeUrl",
        c.skills,
        c.is_active as "isActive",
        c.certificate,
        c.created_at,
        c.updated_at,
        4.5 as rating
      FROM courses c
      WHERE c.id = $1
    `;

    const courseResult = await pool.query(courseQuery, [id]);
    
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Check if non-admin user can access inactive course
    if (userRole !== 'admin' && !course.isActive) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Add enrollment information for students
    if (userRole === 'student' && userId) {
      try {
        const enrollmentQuery = `
          SELECT 
            CASE WHEN id IS NOT NULL THEN true ELSE false END as "isEnrolled",
            COALESCE(is_completed, false) as "isCompleted",
            COALESCE(progress, 0) as progress
          FROM course_enrollments 
          WHERE course_id = $1 AND student_id = $2
        `;
        
        const enrollmentResult = await pool.query(enrollmentQuery, [id, userId]);
        
        if (enrollmentResult.rows.length > 0) {
          const enrollment = enrollmentResult.rows[0];
          course.isEnrolled = enrollment.isEnrolled;
          course.isCompleted = enrollment.isCompleted;
          course.progress = enrollment.progress;
        } else {
          course.isEnrolled = false;
          course.isCompleted = false;
          course.progress = 0;
        }
      } catch (enrollmentError) {
        console.warn('Error fetching enrollment data:', enrollmentError);
        course.isEnrolled = false;
        course.isCompleted = false;
        course.progress = 0;
      }
    } else {
      course.isEnrolled = false;
      course.isCompleted = false;
      course.progress = 0;
    }

    course.enrolled = 0; // We can calculate this later if needed

    // Get lessons
    try {
      const lessonsQuery = `
        SELECT * FROM course_lessons 
        WHERE course_id = $1 
        ORDER BY order_index ASC
      `;
      const lessonsResult = await pool.query(lessonsQuery, [id]);
      course.lessons = lessonsResult.rows;
    } catch (lessonsError) {
      console.warn('Error fetching lessons:', lessonsError);
      course.lessons = [];
    }

    res.json(course);
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    console.error('Error fetching course:', error);
    console.error('Error details:', errorDetails);
    res.status(500).json({ 
      error: 'Failed to fetch course',
      details: process.env.NODE_ENV === 'development' ? errorDetails.message : undefined
    });
  }
});

// Create course (admin only)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Course creation request from user:', req.user?.email, 'role:', req.user?.role);
    console.log('Request body:', req.body);
    
    if (req.user?.role !== 'admin') {
      console.log('Access denied: User is not admin');
      return res.status(403).json({ error: 'Admin access required' });
    }

    const courseData = req.body;
    const userId = req.user.id;

    const query = `
      INSERT INTO courses (
        title, description, category, level, duration, lessons, 
        instructor, thumbnail, course_url, youtube_url, skills, is_active, certificate, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      courseData.title,
      courseData.description,
      courseData.category,
      courseData.level,
      courseData.duration,
      courseData.lessons || 0,
      courseData.instructor,
      courseData.thumbnail,
      courseData.courseUrl || courseData.course_url, // Handle both camelCase and snake_case
      courseData.youtubeUrl || courseData.youtube_url, // Handle both camelCase and snake_case
      courseData.skills || [],
      courseData.isActive ?? courseData.is_active ?? true, // Handle both camelCase and snake_case
      courseData.certificate ?? true,
      userId
    ];

    console.log('Executing query with values:', values);
    const result = await pool.query(query, values);
    const createdCourse = result.rows[0];
    console.log('Course created successfully:', createdCourse);

    // If course content is provided, create lessons
    if (courseData.courseContent && Array.isArray(courseData.courseContent)) {
      console.log('Creating course lessons:', courseData.courseContent.length);
      
      for (let i = 0; i < courseData.courseContent.length; i++) {
        const content = courseData.courseContent[i];
        const lessonQuery = `
          INSERT INTO course_lessons (course_id, title, description, duration, order_index)
          VALUES ($1, $2, $3, $4, $5)
        `;
        
        // Calculate duration from start and end time
        const durationSeconds = content.endTime - content.startTime;
        const durationMinutes = Math.ceil(durationSeconds / 60);
        const durationString = `${durationMinutes} min`;
        
        await pool.query(lessonQuery, [
          createdCourse.id,
          content.title,
          content.description,
          durationString,
          content.order || i + 1
        ]);
      }
    }

    res.status(201).json(createdCourse);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Update course (admin only)
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const courseData = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Map camelCase to snake_case for database columns
    const fieldMapping: Record<string, string> = {
      courseUrl: 'course_url',
      youtubeUrl: 'youtube_url',
      isActive: 'is_active'
    };

    Object.entries(courseData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMapping[key] || key;
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `
      UPDATE courses 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Toggle course active status (admin only)
router.put('/:id/toggle-active', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const query = `
      UPDATE courses 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling course status:', error);
    res.status(500).json({ error: 'Failed to toggle course status' });
  }
});

// Delete course (admin only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// Enroll in course (students only)
router.post('/:id/enroll', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Student access required' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    // Check if course exists and is active
    const courseCheck = await pool.query('SELECT * FROM courses WHERE id = $1 AND is_active = true', [id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found or inactive' });
    }

    // Check if already enrolled
    const enrollmentCheck = await pool.query(
      'SELECT * FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
      [id, userId]
    );

    if (enrollmentCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Create enrollment
    const enrollmentQuery = `
      INSERT INTO course_enrollments (course_id, student_id)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await pool.query(enrollmentQuery, [id, userId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

// Update lesson progress
router.put('/:courseId/lessons/:lessonId/progress', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Student access required' });
    }

    const { courseId, lessonId } = req.params;
    const { completed } = req.body;
    const userId = req.user.id;

    // Get enrollment
    const enrollmentResult = await pool.query(
      'SELECT * FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
      [courseId, userId]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    const enrollment = enrollmentResult.rows[0];

    // Update or create lesson progress
    const progressQuery = `
      INSERT INTO course_lesson_progress (enrollment_id, lesson_id, is_completed, completed_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (enrollment_id, lesson_id)
      DO UPDATE SET 
        is_completed = $3,
        completed_at = CASE WHEN $3 THEN $4 ELSE NULL END
      RETURNING *
    `;

    const progressResult = await pool.query(progressQuery, [
      enrollment.id,
      lessonId,
      completed,
      completed ? new Date() : null
    ]);

    // Update overall course progress
    const totalLessonsResult = await pool.query(
      'SELECT COUNT(*) as total FROM course_lessons WHERE course_id = $1',
      [courseId]
    );

    const completedLessonsResult = await pool.query(`
      SELECT COUNT(*) as completed 
      FROM course_lesson_progress clp
      JOIN course_lessons cl ON clp.lesson_id = cl.id
      WHERE clp.enrollment_id = $1 AND clp.is_completed = true AND cl.course_id = $2
    `, [enrollment.id, courseId]);

    const totalLessons = parseInt(totalLessonsResult.rows[0].total);
    const completedLessons = parseInt(completedLessonsResult.rows[0].completed);
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const isCompleted = progress === 100;

    // Update enrollment progress
    await pool.query(`
      UPDATE course_enrollments 
      SET progress = $1, is_completed = $2, completed_at = $3
      WHERE id = $4
    `, [progress, isCompleted, isCompleted ? new Date() : null, enrollment.id]);

    res.json({
      ...progressResult.rows[0],
      course_progress: progress,
      course_completed: isCompleted
    });
  } catch (error) {
    console.error('Error updating lesson progress:', error);
    res.status(500).json({ error: 'Failed to update lesson progress' });
  }
});

// Get user's certificates
router.get('/certificates/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Student access required' });
    }

    const userId = req.user.id;

    const query = `
      SELECT 
        cc.*,
        c.title as course_title,
        c.skills,
        ce.completed_at
      FROM course_certificates cc
      JOIN course_enrollments ce ON cc.enrollment_id = ce.id
      JOIN courses c ON ce.course_id = c.id
      WHERE ce.student_id = $1
      ORDER BY cc.issued_at DESC
    `;

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

export default router;