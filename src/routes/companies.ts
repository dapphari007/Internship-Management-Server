import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { CreateCompanyData, UpdateCompanyData } from '../models/Company.js';

const router = express.Router();

// Get all companies (public)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, industry, location, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM companies WHERE status = \'active\'';
    let countQuery = 'SELECT COUNT(*) FROM companies WHERE status = \'active\'';
    const queryParams: any[] = [];

    if (industry) {
      query += ` AND industry = $${queryParams.length + 1}`;
      countQuery += ` AND industry = $${queryParams.length + 1}`;
      queryParams.push(industry);
    }

    if (location) {
      query += ` AND location ILIKE $${queryParams.length + 1}`;
      countQuery += ` AND location ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${location}%`);
    }

    if (search) {
      query += ` AND (name ILIKE $${queryParams.length + 1} OR description ILIKE $${queryParams.length + 1})`;
      countQuery += ` AND (name ILIKE $${queryParams.length + 1} OR description ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [companiesResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalCompanies = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCompanies / Number(limit));

    res.json({
      companies: companiesResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCompanies,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single company
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's company profile (company only)
router.get('/profile/me', authenticateToken, requireRole(['company']), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM companies WHERE user_id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create company profile (company only)
router.post('/profile', authenticateToken, requireRole(['company']), [
  body('name').trim().isLength({ min: 2 }),
  body('description').trim().isLength({ min: 50 }),
  body('industry').trim().isLength({ min: 2 }),
  body('company_size').isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
  body('location').trim().isLength({ min: 2 }),
  body('contact_email').isEmail(),
  body('website').optional().isURL(),
  body('linkedin_url').optional().isURL(),
  body('twitter_url').optional().isURL(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if company profile already exists
    const existingCompany = await pool.query(
      'SELECT id FROM companies WHERE user_id = $1',
      [req.user?.id]
    );

    if (existingCompany.rows.length > 0) {
      return res.status(400).json({ error: 'Company profile already exists' });
    }

    const companyData: CreateCompanyData = {
      ...req.body,
      user_id: req.user?.id,
    };

    // Generate slug from company name
    const slug = companyData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = await pool.query(`
      INSERT INTO companies (
        user_id, name, slug, description, website, industry, company_size, 
        location, founded_year, contact_email, contact_phone, linkedin_url, 
        twitter_url, status, verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', false, NOW(), NOW())
      RETURNING *
    `, [
      companyData.user_id,
      companyData.name,
      slug,
      companyData.description,
      companyData.website || null,
      companyData.industry,
      companyData.company_size,
      companyData.location,
      companyData.founded_year || null,
      companyData.contact_email,
      companyData.contact_phone || null,
      companyData.linkedin_url || null,
      companyData.twitter_url || null,
    ]);

    res.status(201).json({
      message: 'Company profile created successfully',
      company: result.rows[0],
    });
  } catch (error) {
    console.error('Create company profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update company profile (company only)
router.put('/profile', authenticateToken, requireRole(['company']), async (req: AuthRequest, res) => {
  try {
    const updateData: UpdateCompanyData = req.body;

    // Build dynamic query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE companies SET ${setClause}, updated_at = NOW() WHERE user_id = $1 RETURNING *`;

    const result = await pool.query(query, [req.user?.id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json({
      message: 'Company profile updated successfully',
      company: result.rows[0],
    });
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Create company (admin only)
router.post('/admin/create', authenticateToken, requireRole(['admin']), [
  body('name').trim().isLength({ min: 2 }),
  body('description').trim().isLength({ min: 50 }),
  body('industry').trim().isLength({ min: 2 }),
  body('company_size').isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
  body('location').trim().isLength({ min: 2 }),
  body('contact_email').isEmail(),
  body('website').optional().isURL(),
  body('linkedin_url').optional().isURL(),
  body('twitter_url').optional().isURL(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const companyData: CreateCompanyData = req.body;

    // Generate slug from company name
    const slug = companyData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if company with same name or slug already exists
    const existingCompany = await pool.query(
      'SELECT id FROM companies WHERE name = $1 OR slug = $2',
      [companyData.name, slug]
    );

    if (existingCompany.rows.length > 0) {
      return res.status(400).json({ error: 'Company with this name already exists' });
    }

    const result = await pool.query(`
      INSERT INTO companies (
        name, slug, description, website, industry, company_size, 
        location, founded_year, contact_email, contact_phone, linkedin_url, 
        twitter_url, status, verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', false, NOW(), NOW())
      RETURNING *
    `, [
      companyData.name,
      slug,
      companyData.description,
      companyData.website || null,
      companyData.industry,
      companyData.company_size,
      companyData.location,
      companyData.founded_year || null,
      companyData.contact_email,
      companyData.contact_phone || null,
      companyData.linkedin_url || null,
      companyData.twitter_url || null,
    ]);

    res.status(201).json({
      message: 'Company created successfully',
      company: result.rows[0],
    });
  } catch (error) {
    console.error('Admin create company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Update company (admin only)
router.put('/admin/:id', authenticateToken, requireRole(['admin']), [
  body('name').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim().isLength({ min: 50 }),
  body('industry').optional().trim().isLength({ min: 2 }),
  body('company_size').optional().isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
  body('location').optional().trim().isLength({ min: 2 }),
  body('contact_email').optional().isEmail(),
  body('website').optional().isURL(),
  body('linkedin_url').optional().isURL(),
  body('twitter_url').optional().isURL(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData: UpdateCompanyData = req.body;

    // Build dynamic query
    const fields = Object.keys(updateData).filter(key => updateData[key as keyof UpdateCompanyData] !== undefined);
    const values = fields.map(field => updateData[field as keyof UpdateCompanyData]);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update slug if name is being updated
    if (updateData.name) {
      const slug = updateData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      fields.push('slug');
      values.push(slug);
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE companies SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;

    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      message: 'Company updated successfully',
      company: result.rows[0],
    });
  } catch (error) {
    console.error('Admin update company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get company's internships (company only)
router.get('/profile/internships', authenticateToken, requireRole(['company']), async (req: AuthRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status,
      location_type,
      stipend_min,
      stipend_max,
      created_after,
      created_before,
      deadline_after,
      deadline_before,
      min_applications,
      max_applications,
      min_views,
      max_views,
      location,
      skills
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        i.*,
        c.name as company_name,
        COALESCE(i.views_count, 0) as views_count,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'shortlisted') as shortlisted_count,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'accepted') as hired_count
      FROM internships i
      JOIN companies c ON i.company_id = c.id
      WHERE c.user_id = $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM internships i
      JOIN companies c ON i.company_id = c.id
      WHERE c.user_id = $1
    `;
    const queryParams: any[] = [req.user?.id];

    // Apply filters
    if (status) {
      query += ` AND i.status = $${queryParams.length + 1}`;
      countQuery += ` AND i.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (location_type) {
      query += ` AND i.location_type = $${queryParams.length + 1}`;
      countQuery += ` AND i.location_type = $${queryParams.length + 1}`;
      queryParams.push(location_type);
    }

    if (location) {
      query += ` AND i.location ILIKE $${queryParams.length + 1}`;
      countQuery += ` AND i.location ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${location}%`);
    }

    if (skills) {
      const skillsArray = skills.toString().split(',').map(s => s.trim());
      query += ` AND (`;
      countQuery += ` AND (`;
      skillsArray.forEach((skill, index) => {
        if (index > 0) {
          query += ` OR `;
          countQuery += ` OR `;
        }
        query += `$${queryParams.length + 1} = ANY(i.skills_required)`;
        countQuery += `$${queryParams.length + 1} = ANY(i.skills_required)`;
        queryParams.push(skill);
      });
      query += `)`;
      countQuery += `)`;
    }

    if (stipend_min) {
      query += ` AND i.stipend >= $${queryParams.length + 1}`;
      countQuery += ` AND i.stipend >= $${queryParams.length + 1}`;
      queryParams.push(parseInt(stipend_min.toString()));
    }

    if (stipend_max) {
      query += ` AND i.stipend <= $${queryParams.length + 1}`;
      countQuery += ` AND i.stipend <= $${queryParams.length + 1}`;
      queryParams.push(parseInt(stipend_max.toString()));
    }

    if (created_after) {
      query += ` AND i.created_at >= $${queryParams.length + 1}`;
      countQuery += ` AND i.created_at >= $${queryParams.length + 1}`;
      queryParams.push(created_after);
    }

    if (created_before) {
      query += ` AND i.created_at <= $${queryParams.length + 1}`;
      countQuery += ` AND i.created_at <= $${queryParams.length + 1}`;
      queryParams.push(created_before);
    }

    if (deadline_after) {
      query += ` AND i.application_deadline >= $${queryParams.length + 1}`;
      countQuery += ` AND i.application_deadline >= $${queryParams.length + 1}`;
      queryParams.push(deadline_after);
    }

    if (deadline_before) {
      query += ` AND i.application_deadline <= $${queryParams.length + 1}`;
      countQuery += ` AND i.application_deadline <= $${queryParams.length + 1}`;
      queryParams.push(deadline_before);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [internshipsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalInternships = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalInternships / Number(limit));

    // Transform the data to include stats
    let internshipsWithStats = internshipsResult.rows.map(internship => ({
      ...internship,
      views: parseInt(internship.views_count) || 0,
      applicants: parseInt(internship.applications_count) || 0,
      shortlisted: parseInt(internship.shortlisted_count) || 0,
      hired: parseInt(internship.hired_count) || 0,
    }));

    // Apply performance metrics filters (post-query filtering)
    if (min_applications || max_applications || min_views || max_views) {
      internshipsWithStats = internshipsWithStats.filter(internship => {
        let matches = true;
        
        if (min_applications) {
          matches = matches && internship.applicants >= parseInt(min_applications.toString());
        }
        if (max_applications) {
          matches = matches && internship.applicants <= parseInt(max_applications.toString());
        }
        if (min_views) {
          matches = matches && internship.views >= parseInt(min_views.toString());
        }
        if (max_views) {
          matches = matches && internship.views <= parseInt(max_views.toString());
        }
        
        return matches;
      });
    }

    res.json({
      internships: internshipsWithStats,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalInternships,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get company internships error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;