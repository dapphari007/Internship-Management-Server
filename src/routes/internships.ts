import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { CreateInternshipData, UpdateInternshipData } from '../models/Internship.js';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

// Get all internships (public)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, location, skills, company, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT i.*, c.name as company_name, c.logo_url as company_logo,
             (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.status = 'published' AND i.application_deadline > NOW()
    `;
    let countQuery = `
      SELECT COUNT(*) FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.status = 'published' AND i.application_deadline > NOW()
    `;
    const queryParams: any[] = [];

    if (location) {
      query += ` AND i.location ILIKE $${queryParams.length + 1}`;
      countQuery += ` AND i.location ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${location}%`);
    }

    if (skills) {
      query += ` AND i.skills_required && $${queryParams.length + 1}`;
      countQuery += ` AND i.skills_required && $${queryParams.length + 1}`;
      queryParams.push(Array.isArray(skills) ? skills : [skills]);
    }

    if (company) {
      query += ` AND c.name ILIKE $${queryParams.length + 1}`;
      countQuery += ` AND c.name ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${company}%`);
    }

    if (search) {
      query += ` AND (i.title ILIKE $${queryParams.length + 1} OR i.description ILIKE $${queryParams.length + 1})`;
      countQuery += ` AND (i.title ILIKE $${queryParams.length + 1} OR i.description ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [internshipsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalInternships = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalInternships / Number(limit));

    // Debug log to verify applications_count is being fetched
    if (process.env.NODE_ENV === 'development' && internshipsResult.rows.length > 0) {
      console.log('Sample internship data:', {
        title: internshipsResult.rows[0].title,
        applications_count: internshipsResult.rows[0].applications_count,
        id: internshipsResult.rows[0].id
      });
    }

    res.json({
      internships: internshipsResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalInternships,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get internships error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single internship
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT i.*, c.name as company_name, c.logo_url as company_logo, c.description as company_description,
             (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count,
             (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'shortlisted') as shortlisted_count,
             (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'accepted') as hired_count
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get internship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track internship view
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const viewerIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Get user ID if authenticated
    const token = req.headers.authorization?.split(' ')[1];
    let viewerId = null;
    
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        viewerId = decoded.id;
      } catch (error) {
        // Token invalid, continue as anonymous view
      }
    }

    // Check if internship exists
    const internshipResult = await pool.query('SELECT id FROM internships WHERE id = $1', [id]);
    if (internshipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    // Insert view record (duplicate views from same user/IP within 24 hours are ignored)
    const viewQuery = `
      INSERT INTO internship_views (internship_id, viewer_id, viewer_ip, user_agent)
      SELECT $1, $2, $3, $4
      WHERE NOT EXISTS (
        SELECT 1 FROM internship_views 
        WHERE internship_id = $1 
        AND (
          (viewer_id IS NOT NULL AND viewer_id = $2) OR
          (viewer_id IS NULL AND viewer_ip = $3)
        )
        AND viewed_at > NOW() - INTERVAL '24 hours'
      )
      RETURNING id
    `;
    
    const viewResult = await pool.query(viewQuery, [id, viewerId, viewerIp, userAgent]);
    
    res.json({ 
      success: true, 
      viewRecorded: viewResult.rows.length > 0 
    });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create internship (company only)
router.post('/', authenticateToken, requireRole(['company']), [
  body('title').trim().isLength({ min: 5 }),
  body('description').trim().isLength({ min: 50 }),
  body('requirements').isArray({ min: 1 }),
  body('responsibilities').isArray({ min: 1 }),
  body('skills_required').isArray({ min: 1 }),
  body('location').trim().isLength({ min: 2 }),
  body('location_type').isIn(['remote', 'onsite', 'hybrid']),
  body('duration').trim().isLength({ min: 2 }),
  body('application_deadline').isISO8601(),
  body('start_date').isISO8601(),
  body('positions_available').isInt({ min: 1 }),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get user's company
    const companyResult = await pool.query(
      'SELECT id FROM companies WHERE user_id = $1',
      [req.user?.id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(400).json({ error: 'Company profile not found' });
    }

    const company_id = companyResult.rows[0].id;
    const internshipData: CreateInternshipData = {
      ...req.body,
      company_id,
    };

    const result = await pool.query(`
      INSERT INTO internships (
        company_id, title, description, requirements, responsibilities, 
        skills_required, location, location_type, duration, stipend, 
        application_deadline, start_date, end_date, positions_available, 
        positions_filled, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 'draft', NOW(), NOW())
      RETURNING *
    `, [
      internshipData.company_id,
      internshipData.title,
      internshipData.description,
      internshipData.requirements,
      internshipData.responsibilities,
      internshipData.skills_required,
      internshipData.location,
      internshipData.location_type,
      internshipData.duration,
      internshipData.stipend || null,
      internshipData.application_deadline,
      internshipData.start_date,
      internshipData.end_date || null,
      internshipData.positions_available,
    ]);

    res.status(201).json({
      message: 'Internship created successfully',
      internship: result.rows[0],
    });
  } catch (error) {
    console.error('Create internship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update internship (company only)
router.put('/:id', authenticateToken, requireRole(['company']), [
  body('title').optional().trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('description').optional().trim().isLength({ min: 50 }).withMessage('Description must be at least 50 characters'),
  body('requirements').optional().isArray({ min: 1 }).withMessage('At least one requirement is required'),
  body('responsibilities').optional().isArray({ min: 1 }).withMessage('At least one responsibility is required'),
  body('skills_required').optional().isArray({ min: 1 }).withMessage('At least one skill is required'),
  body('location').optional().trim().isLength({ min: 2 }).withMessage('Location must be at least 2 characters'),
  body('location_type').optional().isIn(['remote', 'onsite', 'hybrid']).withMessage('Invalid location type'),
  body('duration').optional().trim().isLength({ min: 2 }).withMessage('Duration must be at least 2 characters'),
  body('application_deadline').optional().isISO8601().withMessage('Invalid application deadline date'),
  body('start_date').optional().isISO8601().withMessage('Invalid start date'),
  body('positions_available').optional().isInt({ min: 1 }).withMessage('Positions available must be at least 1'),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const updateData: UpdateInternshipData = req.body;

    // Verify ownership
    const ownershipResult = await pool.query(`
      SELECT i.id FROM internships i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = $1 AND c.user_id = $2
    `, [id, req.user?.id]);

    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Internship not found or access denied' });
    }

    // Get current internship data to check for status changes
    const currentInternship = await pool.query(
      'SELECT status, title FROM internships WHERE id = $1',
      [id]
    );

    // Build dynamic query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE internships SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;

    const result = await pool.query(query, [id, ...values]);

    // Check if status changed to 'published' and send notifications
    if (updateData.status === 'published' && 
        currentInternship.rows[0]?.status !== 'published') {
      
      // Get company name for notification
      const companyResult = await pool.query(
        'SELECT c.name FROM companies c JOIN internships i ON c.id = i.company_id WHERE i.id = $1',
        [id]
      );

      if (companyResult.rows.length > 0) {
        const companyName = companyResult.rows[0].name;
        
        try {
          // Notify students about new internship
          await NotificationService.notifyNewInternshipPosting(
            id,
            result.rows[0].title,
            companyName
          );

          // Notify company that their internship was published
          await NotificationService.notifyInternshipPublished(req.user?.id || '', {
            internshipTitle: result.rows[0].title,
            internshipId: id
          });
        } catch (notificationError) {
          console.error('Failed to send new internship notifications:', notificationError);
          // Don't fail the request if notification fails
        }
      }
    }

    res.json({
      message: 'Internship updated successfully',
      internship: result.rows[0],
    });
  } catch (error) {
    console.error('Update internship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete internship (company only)
router.delete('/:id', authenticateToken, requireRole(['company']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const ownershipResult = await pool.query(`
      SELECT i.id FROM internships i
      JOIN companies c ON i.company_id = c.id
      WHERE i.id = $1 AND c.user_id = $2
    `, [id, req.user?.id]);

    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Internship not found or access denied' });
    }

    await pool.query('DELETE FROM internships WHERE id = $1', [id]);

    res.json({ message: 'Internship deleted successfully' });
  } catch (error) {
    console.error('Delete internship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all internships (admin only) - includes all statuses
router.get('/admin/all', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT i.*, c.name as company_name, c.logo_url as company_logo,
             (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count
      FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM internships i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (status) {
      query += ` AND i.status = $${queryParams.length + 1}`;
      countQuery += ` AND i.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (search) {
      query += ` AND (i.title ILIKE $${queryParams.length + 1} OR i.description ILIKE $${queryParams.length + 1})`;
      countQuery += ` AND (i.title ILIKE $${queryParams.length + 1} OR i.description ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [internshipsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalInternships = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalInternships / Number(limit));

    res.json({
      internships: internshipsResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalInternships,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get all internships error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;