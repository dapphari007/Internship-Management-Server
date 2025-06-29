import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { CreateApplicationData, UpdateApplicationData } from '../models/Application.js';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

// Get user's applications (student only)
router.get('/my-applications', authenticateToken, requireRole(['student']), async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT a.*, i.title as internship_title, i.location, i.location_type, 
             c.name as company_name, c.logo_url as company_logo
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      WHERE a.student_id = $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM applications a
      WHERE a.student_id = $1
    `;
    const queryParams: any[] = [req.user?.id];

    if (status) {
      query += ` AND a.status = $${queryParams.length + 1}`;
      countQuery += ` AND a.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` ORDER BY a.applied_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [applicationsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalApplications = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalApplications / Number(limit));

    res.json({
      applications: applicationsResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalApplications,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get applications for company's internships (company only)
router.get('/company-applications', authenticateToken, requireRole(['company']), async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 10, status, internship_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT a.*, i.title as internship_title, u.full_name as student_name, 
             u.email as student_email, u.university, u.major
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      JOIN users u ON a.student_id = u.id
      WHERE c.user_id = $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      WHERE c.user_id = $1
    `;
    const queryParams: any[] = [req.user?.id];

    if (status) {
      query += ` AND a.status = $${queryParams.length + 1}`;
      countQuery += ` AND a.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (internship_id) {
      query += ` AND a.internship_id = $${queryParams.length + 1}`;
      countQuery += ` AND a.internship_id = $${queryParams.length + 1}`;
      queryParams.push(internship_id);
    }

    query += ` ORDER BY a.applied_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [applicationsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalApplications = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalApplications / Number(limit));

    res.json({
      applications: applicationsResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalApplications,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get company applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply for internship (student only)
router.post('/', authenticateToken, requireRole(['student']), [
  body('internship_id').isUUID(),
  body('cover_letter').trim().isLength({ min: 50 }),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const applicationData: CreateApplicationData = {
      ...req.body,
      student_id: req.user?.id,
    };

    // Check if internship exists and is still accepting applications
    const internshipResult = await pool.query(
      'SELECT id, application_deadline, status FROM internships WHERE id = $1',
      [applicationData.internship_id]
    );

    if (internshipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const internship = internshipResult.rows[0];
    if (internship.status !== 'published') {
      return res.status(400).json({ error: 'Internship is not accepting applications' });
    }

    if (new Date(internship.application_deadline) < new Date()) {
      return res.status(400).json({ error: 'Application deadline has passed' });
    }

    // Check if user already applied
    const existingApplication = await pool.query(
      'SELECT id FROM applications WHERE internship_id = $1 AND student_id = $2',
      [applicationData.internship_id, applicationData.student_id]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({ error: 'You have already applied for this internship' });
    }

    const result = await pool.query(`
      INSERT INTO applications (internship_id, student_id, cover_letter, resume_url, status, applied_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW(), NOW())
      RETURNING *
    `, [
      applicationData.internship_id,
      applicationData.student_id,
      applicationData.cover_letter,
      applicationData.resume_url || null,
    ]);

    // Get additional data for notification
    const notificationDataQuery = await pool.query(`
      SELECT i.title as internship_title, i.company_id, c.user_id as company_user_id, u.full_name as student_name
      FROM internships i
      JOIN companies c ON i.company_id = c.id
      JOIN users u ON u.id = $1
      WHERE i.id = $2
    `, [applicationData.student_id, applicationData.internship_id]);

    if (notificationDataQuery.rows.length > 0) {
      const notificationData = notificationDataQuery.rows[0];
      
      // Send notification to company
      await NotificationService.notifyNewApplication(notificationData.company_user_id, {
        studentName: notificationData.student_name,
        internshipTitle: notificationData.internship_title,
        applicationId: result.rows[0].id,
        internshipId: applicationData.internship_id
      });
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      application: result.rows[0],
    });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update application status (company only)
router.put('/:id/status', authenticateToken, requireRole(['company']), [
  body('status').isIn(['pending', 'reviewed', 'shortlisted', 'accepted', 'rejected']),
  body('response_message').optional().trim(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, response_message }: UpdateApplicationData = req.body;

    // Verify the application belongs to company's internship
    const ownershipResult = await pool.query(`
      SELECT a.id FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      WHERE a.id = $1 AND c.user_id = $2
    `, [id, req.user?.id]);

    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or access denied' });
    }

    const result = await pool.query(`
      UPDATE applications 
      SET status = $1, response_message = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, response_message || null, id]);

    // Get application details for notification
    const applicationDetails = await pool.query(`
      SELECT a.student_id, i.title as internship_title, c.name as company_name
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      WHERE a.id = $1
    `, [id]);

    if (applicationDetails.rows.length > 0) {
      const { student_id, internship_title, company_name } = applicationDetails.rows[0];
      
      // Send notification to student
      try {
        await NotificationService.notifyApplicationStatusChange(
          id,
          student_id,
          status as string,
          internship_title,
          company_name
        );
      } catch (notificationError) {
        console.error('Failed to send application status notification:', notificationError);
        // Don't fail the request if notification fails
      }
    }

    res.json({
      message: 'Application status updated successfully',
      application: result.rows[0],
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Withdraw application (student only)
router.put('/:id/withdraw', authenticateToken, requireRole(['student']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const ownershipResult = await pool.query(
      'SELECT id FROM applications WHERE id = $1 AND student_id = $2',
      [id, req.user?.id]
    );

    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or access denied' });
    }

    const result = await pool.query(`
      UPDATE applications 
      SET status = 'withdrawn', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json({
      message: 'Application withdrawn successfully',
      application: result.rows[0],
    });
  } catch (error) {
    console.error('Withdraw application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all applications (admin only)
router.get('/admin/all', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT a.*, i.title as internship_title, i.location, i.location_type, 
             c.name as company_name, c.logo_url as company_logo,
             u.full_name as student_name, u.email as student_email, u.university, u.major
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      JOIN users u ON a.student_id = u.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN companies c ON i.company_id = c.id
      JOIN users u ON a.student_id = u.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (status) {
      query += ` AND a.status = $${queryParams.length + 1}`;
      countQuery += ` AND a.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` ORDER BY a.applied_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [applicationsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalApplications = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalApplications / Number(limit));

    res.json({
      applications: applicationsResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalApplications,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;