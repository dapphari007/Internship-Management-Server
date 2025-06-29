import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

// Get all tasks (admin only) or user's tasks
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    let result;

    if (user?.role === 'admin') {
      // Admin can see all tasks
      result = await pool.query(`
        SELECT 
          t.*,
          u1.full_name as assigned_to_name,
          u1.email as assigned_to_email,
          u2.full_name as assigned_by_name,
          u2.email as assigned_by_email,
          u3.full_name as feedback_by_name,
          i.title as internship_title
        FROM admin_tasks t
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.assigned_by = u2.id
        LEFT JOIN users u3 ON t.feedback_by = u3.id
        LEFT JOIN internships i ON t.internship_id = i.id
        ORDER BY t.created_at DESC
      `);
    } else if (user?.role === 'company') {
      // Companies can see tasks they created
      result = await pool.query(`
        SELECT 
          t.*,
          u1.full_name as assigned_to_name,
          u1.email as assigned_to_email,
          u2.full_name as assigned_by_name,
          u2.email as assigned_by_email,
          u3.full_name as feedback_by_name,
          i.title as internship_title
        FROM admin_tasks t
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.assigned_by = u2.id
        LEFT JOIN users u3 ON t.feedback_by = u3.id
        LEFT JOIN internships i ON t.internship_id = i.id
        WHERE t.assigned_by = $1
        ORDER BY t.created_at DESC
      `, [user?.id]);
    } else {
      // Students can only see their assigned tasks
      result = await pool.query(`
        SELECT 
          t.*,
          u2.full_name as assigned_by_name,
          u2.email as assigned_by_email,
          u3.full_name as feedback_by_name,
          i.title as internship_title
        FROM admin_tasks t
        LEFT JOIN users u2 ON t.assigned_by = u2.id
        LEFT JOIN users u3 ON t.feedback_by = u3.id
        LEFT JOIN internships i ON t.internship_id = i.id
        WHERE t.assigned_to = $1 AND t.is_active = true
        ORDER BY t.created_at DESC
      `, [user?.id]);
    }

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get tasks by internship ID
router.get('/internship/:internshipId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { internshipId } = req.params;

    // Verify internship exists and user has access
    const internshipCheck = await pool.query(`
      SELECT i.*, c.user_id as company_user_id
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.id = $1
    `, [internshipId]);

    if (internshipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const internship = internshipCheck.rows[0];

    // Check if user has access to this internship's tasks
    let hasAccess = false;
    if (user?.role === 'admin') {
      hasAccess = true;
    } else if (user?.role === 'company' && internship.company_user_id === user.id) {
      hasAccess = true;
    } else if (user?.role === 'student') {
      // Check if student has applied to this internship
      const applicationCheck = await pool.query(
        'SELECT id FROM applications WHERE internship_id = $1 AND student_id = $2',
        [internshipId, user.id]
      );
      hasAccess = applicationCheck.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to view tasks for this internship' });
    }

    // Build query based on user role
    let query = `
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email,
        u3.full_name as feedback_by_name,
        i.title as internship_title
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      LEFT JOIN users u3 ON t.feedback_by = u3.id
      LEFT JOIN internships i ON t.internship_id = i.id
      WHERE t.internship_id = $1
    `;
    
    let params = [internshipId];

    // Add additional filters based on user role
    if (user?.role === 'student') {
      // Students can only see tasks assigned to them
      query += ' AND t.assigned_to = $2 AND t.is_active = true';
      params.push(user.id);
    } else if (user?.role === 'company') {
      // Companies can see all tasks for their internships
      query += ' AND t.is_active = true';
    }
    // Admins can see all tasks

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);

    res.json({ 
      tasks: result.rows,
      internship: {
        id: internship.id,
        title: internship.title
      }
    });
  } catch (error) {
    console.error('Error fetching tasks by internship ID:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;

    let query = `
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email,
        u3.full_name as feedback_by_name,
        i.title as internship_title
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      LEFT JOIN users u3 ON t.feedback_by = u3.id
      LEFT JOIN internships i ON t.internship_id = i.id
      WHERE t.id = $1
    `;
    
    let params = [id];
    
    // Permission checks
    if (user && user.role === 'student') {
      // Students can only see tasks assigned to them
      query += ' AND t.assigned_to = $2 AND t.is_active = true';
      params.push(user.id);
    } else if (user && user.role === 'company') {
      // Companies can only see tasks they created
      query += ' AND t.assigned_by = $2';
      params.push(user.id);
    }
    // Admins can see all tasks

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create new task (admin only)
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('assignedTo').isUUID().withMessage('Valid assigned user ID is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('points').optional().isInt({ min: 0 }).withMessage('Points must be a non-negative integer'),
  body('internshipId').optional().isUUID().withMessage('Valid internship ID is required'),
], async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (user?.role !== 'admin' && user?.role !== 'company') {
      return res.status(403).json({ error: 'Only admins and companies can create tasks' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, assignedTo, dueDate, priority = 'medium', points = 0, internshipId } = req.body;

    // Check if assigned user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [assignedTo]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assigned user not found' });
    }

    // Check if internship exists (if provided)
    if (internshipId) {
      const internshipCheck = await pool.query('SELECT id FROM internships WHERE id = $1', [internshipId]);
      if (internshipCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Internship not found' });
      }

      // If user is a company, verify they own the internship
      if (user?.role === 'company') {
        const ownershipCheck = await pool.query(`
          SELECT i.id FROM internships i
          LEFT JOIN companies c ON i.company_id = c.id
          WHERE i.id = $1 AND c.user_id = $2
        `, [internshipId, user.id]);
        
        if (ownershipCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Not authorized to create tasks for this internship' });
        }
      }
    }

    // Create the task
    const result = await pool.query(`
      INSERT INTO admin_tasks (title, description, assigned_to, assigned_by, due_date, priority, points, internship_id, status, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', true, NOW(), NOW())
      RETURNING *
    `, [title, description, assignedTo, user.id, dueDate, priority, points, internshipId || null]);

    // Get the created task with user and internship details
    const taskResult = await pool.query(`
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email,
        i.title as internship_title
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      LEFT JOIN internships i ON t.internship_id = i.id
      WHERE t.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({ task: taskResult.rows[0] });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1 }).withMessage('Title cannot be empty'),
  body('description').optional().trim().isLength({ min: 1 }).withMessage('Description cannot be empty'),
  body('assignedTo').optional().isUUID().withMessage('Valid assigned user ID is required'),
  body('dueDate').optional().isISO8601().withMessage('Valid due date is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('points').optional().isInt({ min: 0 }).withMessage('Points must be a non-negative integer'),
  body('status').optional().isIn(['pending', 'in-progress', 'completed', 'rejected']).withMessage('Invalid status'),
], async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { title, description, assignedTo, dueDate, priority, points, status } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if task exists
    const taskCheck = await pool.query('SELECT * FROM admin_tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check permissions
    if (
      user?.role !== 'admin' && 
      ((user?.role === 'student' && task.assigned_to !== user?.id) ||
       (user?.role === 'company' && task.assigned_by !== user?.id))
    ) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }

    // Students can only update status
    if (user?.role === 'student') {
      if (status && ['pending', 'in-progress', 'completed', 'rejected'].includes(status)) {
        await pool.query(
          'UPDATE admin_tasks SET status = $1, updated_at = NOW() WHERE id = $2',
          [status, id]
        );
        
        // Send notification for task completion
        if (status === 'completed' && task.status !== 'completed' && user) {
          try {
            await NotificationService.notifyTaskCompletion(user.id, task.title);
          } catch (notificationError) {
            console.error('Failed to send task completion notification:', notificationError);
          }
        }
      } else {
        return res.status(400).json({ error: 'Students can only update task status' });
      }
    } else {
      // Admin can update all fields
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        updateValues.push(title);
      }
      if (description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(description);
      }
      if (assignedTo !== undefined) {
        updateFields.push(`assigned_to = $${paramCount++}`);
        updateValues.push(assignedTo);
      }
      if (dueDate !== undefined) {
        updateFields.push(`due_date = $${paramCount++}`);
        updateValues.push(dueDate);
      }
      if (priority !== undefined) {
        updateFields.push(`priority = $${paramCount++}`);
        updateValues.push(priority);
      }
      if (points !== undefined) {
        updateFields.push(`points = $${paramCount++}`);
        updateValues.push(points);
      }
      if (status !== undefined) {
        updateFields.push(`status = $${paramCount++}`);
        updateValues.push(status);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(id);
        
        const query = `UPDATE admin_tasks SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;
        await pool.query(query, updateValues);
      }
    }

    // Get the updated task with user and internship details
    const result = await pool.query(`
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email,
        u3.full_name as feedback_by_name,
        i.title as internship_title
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      LEFT JOIN users u3 ON t.feedback_by = u3.id
      LEFT JOIN internships i ON t.internship_id = i.id
      WHERE t.id = $1
    `, [id]);

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Toggle task active status (admin only)
router.put('/:id/toggle-active', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user?.role !== 'admin' && user?.role !== 'company') {
      return res.status(403).json({ error: 'Only admins and companies can activate/deactivate tasks' });
    }

    // Check if task exists
    const taskCheck = await pool.query('SELECT is_active FROM admin_tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentStatus = taskCheck.rows[0].is_active;
    
    // Toggle the active status
    await pool.query(
      'UPDATE admin_tasks SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [!currentStatus, id]
    );

    // Get the updated task with user and internship details
    const result = await pool.query(`
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email,
        u3.full_name as feedback_by_name,
        i.title as internship_title
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      LEFT JOIN users u3 ON t.feedback_by = u3.id
      LEFT JOIN internships i ON t.internship_id = i.id
      WHERE t.id = $1
    `, [id]);

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Error toggling task status:', error);
    res.status(500).json({ error: 'Failed to toggle task status' });
  }
});

// Delete task (admin only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user?.role !== 'admin' && user?.role !== 'company') {
      return res.status(403).json({ error: 'Only admins and companies can delete tasks' });
    }

    // Check if task exists
    const taskCheck = await pool.query('SELECT id FROM admin_tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await pool.query('DELETE FROM admin_tasks WHERE id = $1', [id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Submit task completion with project links
router.post('/:id/submit', authenticateToken, [
  body('githubLink').isURL().withMessage('Valid GitHub link is required'),
  body('deploymentLink').isURL().withMessage('Valid deployment link is required'),
  body('redditPostLink').isURL().withMessage('Valid Reddit post link is required'),
  body('videoExplanationLink').isURL().withMessage('Valid video explanation link is required'),
  body('additionalNotes').optional().isString(),
], async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { githubLink, deploymentLink, redditPostLink, videoExplanationLink, additionalNotes } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if task exists and belongs to the user
    const taskCheck = await pool.query(
      'SELECT * FROM admin_tasks WHERE id = $1 AND assigned_to = $2',
      [id, user?.id]
    );
    
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or not assigned to you' });
    }

    const task = taskCheck.rows[0];

    // Update the task with submission details
    await pool.query(`
      UPDATE admin_tasks 
      SET 
        github_link = $1, 
        deployment_link = $2, 
        reddit_post_link = $3, 
        video_explanation_link = $4, 
        additional_notes = $5,
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = $6
    `, [githubLink, deploymentLink, redditPostLink, videoExplanationLink, additionalNotes, id]);

    // Get the updated task
    const result = await pool.query(`
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE t.id = $1
    `, [id]);

    // Send notification to admin about task submission
    try {
      await NotificationService.notifyTaskCompletion(user?.id || '', task.title);
    } catch (notificationError) {
      console.error('Failed to send task submission notification:', notificationError);
    }

    res.json({ 
      message: 'Task submission successful',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting task:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// Reject task completion with feedback (admin only)
router.post('/:id/reject', authenticateToken, [
  body('feedback').isString().notEmpty().withMessage('Feedback is required'),
], async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { feedback } = req.body;

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reject tasks' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if task exists
    const taskCheck = await pool.query('SELECT * FROM admin_tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Update the task status to rejected and add feedback
    await pool.query(`
      UPDATE admin_tasks 
      SET 
        status = 'rejected', 
        feedback = $1, 
        feedback_by = $2, 
        feedback_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `, [feedback, user.id, id]);

    // Get the updated task
    const result = await pool.query(`
      SELECT 
        t.*,
        u1.full_name as assigned_to_name,
        u1.email as assigned_to_email,
        u2.full_name as assigned_by_name,
        u2.email as assigned_by_email,
        u3.full_name as feedback_by_name
      FROM admin_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      LEFT JOIN users u3 ON t.feedback_by = u3.id
      WHERE t.id = $1
    `, [id]);

    // Send notification to student about task rejection
    try {
      await NotificationService.notifyTaskRejection(task.assigned_to, task.title);
    } catch (notificationError) {
      console.error('Failed to send task rejection notification:', notificationError);
    }

    res.json({ 
      message: 'Task rejected successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error rejecting task:', error);
    res.status(500).json({ error: 'Failed to reject task' });
  }
});

export default router;