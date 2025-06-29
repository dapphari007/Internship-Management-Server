import express, { type Request, type Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Global search endpoint
router.get('/global', 
  authenticateToken,
  [
    query('q').notEmpty().withMessage('Search query is required'),
    query('type').optional().isIn(['all', 'internships', 'students', 'companies', 'tasks', 'my-internships', 'my-applicants', 'pending-applications']).withMessage('Invalid search type'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q: searchQuery, type = 'all', limit = 20 } = req.query;
      const user = req.user;
      const results: any = {
        internships: [],
        students: [],
        companies: [],
        tasks: [],
        applications: []
      };

      const searchTerm = `%${searchQuery}%`;

      // Get company ID if user is a company
      let companyId: string | null = null;
      if (user?.role === 'company') {
        const companyResult = await pool.query(
          'SELECT id FROM companies WHERE user_id = $1',
          [user.id]
        );
        if (companyResult.rows.length > 0) {
          companyId = companyResult.rows[0].id;
        }
      }

      // Search Internships
      if (type === 'all' || type === 'internships') {
        let internshipQuery = `
          SELECT i.*, c.name as company_name, c.logo_url
          FROM internships i
          LEFT JOIN companies c ON i.company_id = c.id
          WHERE (i.title ILIKE $1 OR i.description ILIKE $1 OR c.name ILIKE $1)
          AND i.status = 'published'
        `;
        
        if (user?.role === 'company' && companyId) {
          internshipQuery += ` AND i.company_id = $2`;
        }
        
        internshipQuery += ` ORDER BY i.created_at DESC LIMIT $${user?.role === 'company' && companyId ? 3 : 2}`;
        
        const internshipParams = user?.role === 'company' && companyId
          ? [searchTerm, companyId, limit] 
          : [searchTerm, limit];
          
        const internshipResult = await pool.query(internshipQuery, internshipParams);
        results.internships = internshipResult.rows;
      }

      // Search Students (Admin and Company only)
      if ((type === 'all' || type === 'students') && (user?.role === 'admin' || user?.role === 'company')) {
        const studentQuery = `
          SELECT u.id, u.full_name, u.email, u.avatar_url, u.created_at,
                 u.university, u.major, u.graduation_year, u.skills
          FROM users u
          WHERE u.role = 'student' 
          AND (u.full_name ILIKE $1 OR u.email ILIKE $1 OR u.university ILIKE $1 OR u.major ILIKE $1)
          ORDER BY u.created_at DESC
          LIMIT $2
        `;
        const studentResult = await pool.query(studentQuery, [searchTerm, limit]);
        results.students = studentResult.rows;
      }

      // Search Companies (Admin only)
      if ((type === 'all' || type === 'companies') && user?.role === 'admin') {
        const companyQuery = `
          SELECT c.*, u.email, u.created_at
          FROM companies c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.name ILIKE $1 OR c.description ILIKE $1 OR c.industry ILIKE $1
          ORDER BY c.created_at DESC
          LIMIT $2
        `;
        const companyResult = await pool.query(companyQuery, [searchTerm, limit]);
        results.companies = companyResult.rows;
      }

      // Search Tasks
      if (type === 'all' || type === 'tasks') {
        let taskQuery = `
          SELECT t.*, 
                 t.status
          FROM tasks t
          WHERE (t.title ILIKE $1 OR t.description ILIKE $1)
        `;

        if (user?.role === 'student') {
          taskQuery += ` AND t.student_id = $2`;
        }

        taskQuery += ` ORDER BY t.created_at DESC LIMIT $3`;
        
        const taskResult = await pool.query(taskQuery, [searchTerm, user?.id, limit]);
        results.tasks = taskResult.rows;
      }

      // Company-specific searches
      if (user?.role === 'company' && companyId) {
        
        // Search My Internships
        if (type === 'my-internships') {
          const myInternshipsQuery = `
            SELECT i.*, c.name as company_name, c.logo_url,
                   (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count
            FROM internships i
            LEFT JOIN companies c ON i.company_id = c.id
            WHERE i.company_id = $1
            AND (i.title ILIKE $2 OR i.description ILIKE $2)
            ORDER BY i.created_at DESC
            LIMIT $3
          `;
          const myInternshipsResult = await pool.query(myInternshipsQuery, [companyId, searchTerm, limit]);
          results.internships = myInternshipsResult.rows;
        }

        // Search My Applicants
        if (type === 'my-applicants') {
          const myApplicantsQuery = `
            SELECT DISTINCT u.id, u.full_name, u.email, u.avatar_url, u.created_at,
                   u.university, u.major, u.graduation_year, u.skills,
                   COUNT(a.id) as applications_count
            FROM users u
            JOIN applications a ON u.id = a.student_id
            JOIN internships i ON a.internship_id = i.id
            WHERE i.company_id = $1
            AND (u.full_name ILIKE $2 OR u.email ILIKE $2 OR u.university ILIKE $2 OR u.major ILIKE $2)
            GROUP BY u.id, u.full_name, u.email, u.avatar_url, u.created_at, u.university, u.major, u.graduation_year, u.skills
            ORDER BY applications_count DESC, u.created_at DESC
            LIMIT $3
          `;
          const myApplicantsResult = await pool.query(myApplicantsQuery, [companyId, searchTerm, limit]);
          results.students = myApplicantsResult.rows;
        }

        // Search Pending Applications
        if (type === 'pending-applications') {
          const pendingApplicationsQuery = `
            SELECT a.*, u.full_name as student_name, u.email as student_email, u.university, u.major,
                   i.title as internship_title, i.id as internship_id
            FROM applications a
            JOIN users u ON a.student_id = u.id
            JOIN internships i ON a.internship_id = i.id
            WHERE i.company_id = $1 AND a.status = 'pending'
            AND (u.full_name ILIKE $2 OR i.title ILIKE $2 OR u.university ILIKE $2)
            ORDER BY a.applied_at DESC
            LIMIT $3
          `;
          const pendingApplicationsResult = await pool.query(pendingApplicationsQuery, [companyId, searchTerm, limit]);
          results.applications = pendingApplicationsResult.rows;
        }
      }

      // Calculate total results
      const totalResults = Object.values(results).reduce((sum: number, arr) => sum + (arr as any[]).length, 0);

      res.json({
        query: searchQuery,
        totalResults,
        results
      });

    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Quick search suggestions
router.get('/suggestions',
  authenticateToken,
  [
    query('q').notEmpty().withMessage('Search query is required'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q: searchQuery } = req.query;
      const user = req.user;
      const searchTerm = `%${searchQuery}%`;
      const suggestions: string[] = [];

      // Get internship titles
      let internshipQuery = `
        SELECT DISTINCT title FROM internships 
        WHERE title ILIKE $1 AND status = 'active'
        LIMIT 5
      `;
      const internshipResult = await pool.query(internshipQuery, [searchTerm]);
      suggestions.push(...internshipResult.rows.map((row: any) => row.title));

      // Get company names (if admin or company)
      if (user?.role === 'admin' || user?.role === 'company') {
        const companyQuery = `
          SELECT DISTINCT name FROM companies 
          WHERE name ILIKE $1
          LIMIT 3
        `;
        const companyResult = await pool.query(companyQuery, [searchTerm]);
        suggestions.push(...companyResult.rows.map((row: any) => row.name));
      }

      // Get task titles
      const taskQuery = `
        SELECT DISTINCT title FROM tasks 
        WHERE title ILIKE $1
        LIMIT 3
      `;
      const taskResult = await pool.query(taskQuery, [searchTerm]);
      suggestions.push(...taskResult.rows.map((row: any) => row.title));

      res.json({
        suggestions: [...new Set(suggestions)].slice(0, 8) // Remove duplicates and limit
      });

    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;