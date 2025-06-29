import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import validator from 'validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { UpdateUserData } from '../models/User.js';

// Calculate profile completion percentage based on filled fields
function calculateProfileCompletion(user: any): number {
  // Define required fields for a complete profile
  const requiredFields = [
    'full_name', 'email', 'phone', 'location', 'bio', 
    'university', 'major', 'graduation_year', 'skills'
  ];
  
  // Optional fields that contribute to profile completeness
  const optionalFields = [
    'linkedin_url', 'github_url', 'gpa', 'interests', 'languages'
  ];
  
  // Count filled required fields
  const filledRequired = requiredFields.filter(field => {
    const value = user[field];
    return value !== undefined && value !== null && 
           (typeof value !== 'string' || value.trim() !== '') &&
           (!Array.isArray(value) || value.length > 0);
  }).length;
  
  // Count filled optional fields
  const filledOptional = optionalFields.filter(field => {
    const value = user[field];
    return value !== undefined && value !== null && 
           (typeof value !== 'string' || value.trim() !== '') &&
           (!Array.isArray(value) || value.length > 0);
  }).length;
  
  // Calculate percentage (required fields have more weight)
  const requiredWeight = 0.7;
  const optionalWeight = 0.3;
  
  const requiredPercentage = (filledRequired / requiredFields.length) * requiredWeight * 100;
  const optionalPercentage = (filledOptional / optionalFields.length) * optionalWeight * 100;
  
  return Math.round(requiredPercentage + optionalPercentage);
};

const router = express.Router();

// Get user stats
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.query.userId || req.user?.id;
    
    // If requesting stats for another user, check if requester is admin
    if (req.query.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required to view other users stats' });
    }
    
    // Get user stats from database
    const statsQuery = `
      SELECT 
        u.id,
        u.profile_completion_percentage,
        u.profile_complete,
        u.last_active,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND status = 'completed') as tasks_completed,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id) as total_tasks,
        (SELECT COUNT(*) FROM applications WHERE student_id = u.id) as applications
      FROM users u
      WHERE u.id = $1
    `;
    
    const result = await pool.query(statsQuery, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userStats = result.rows[0];
    
    // Format the response
    res.json({
      id: userStats.id,
      profile_completion: userStats.profile_completion_percentage,
      profile_complete: userStats.profile_complete,
      tasks_completed: parseInt(userStats.tasks_completed) || 0,
      total_tasks: parseInt(userStats.total_tasks) || 0,
      applications: parseInt(userStats.applications) || 0,
      last_active: userStats.last_active
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('Fetching profile for user ID:', req.user?.id);
    
    if (!req.user?.id) {
      console.error('User ID is missing in the request');
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const result = await pool.query(
      'SELECT id, email, full_name, role, avatar_url, phone, location, address, bio, website, linkedin_url, github_url, instagram_url, twitter_url, portfolio_url, university, major, graduation_year, gpa, skills, interests, languages, company_name, company_size, industry, company_description, profile_complete, profile_completion_percentage, verified, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      console.error('User not found in database for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Successfully retrieved profile for user ID:', req.user.id);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get profile error:', error);
    
    // Provide more detailed error information
    if (error.code) {
      console.error('Database error code:', error.code);
      console.error('Database error detail:', error.detail || 'No details available');
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('full_name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().custom(value => {
    if (!value) return true; // Allow empty values
    
    // Remove all non-digit characters for validation
    const digitsOnly = value.replace(/\D/g, '');
    
    // Check if we have a reasonable number of digits for a phone number (7-15 digits)
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }),
  body('website').optional().custom(value => {
    if (!value) return true; // Allow empty values
    // Very basic URL validation
    return value.includes('.') || value.startsWith('http');
  }),
  body('linkedin_url').optional().custom(value => {
    if (!value) return true; // Allow empty values
    // Very basic URL validation
    return value.includes('.') || value.startsWith('http');
  }),
  body('github_url').optional().custom(value => {
    if (!value) return true; // Allow empty values
    // Very basic URL validation
    return value.includes('.') || value.startsWith('http');
  }),
  body('instagram_url').optional().custom(value => {
    if (!value) return true; // Allow empty values
    // Very basic URL validation
    return value.includes('.') || value.startsWith('http');
  }),
  body('twitter_url').optional().custom(value => {
    if (!value) return true; // Allow empty values
    // Very basic URL validation
    return value.includes('.') || value.startsWith('http');
  }),
  body('portfolio_url').optional().custom(value => {
    if (!value) return true; // Allow empty values
    // Very basic URL validation
    return value.includes('.') || value.startsWith('http');
  }),
  body('gpa').optional().custom((value) => {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 10;
  }).withMessage('GPA must be a number between 0 and 10'),
], async (req: AuthRequest, res: Response) => {
  try {
    // Log the request body for debugging
    console.log('Update profile request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData: UpdateUserData = req.body;
    const userId = req.user?.id;

    // Sanitize and process the update data
    const sanitizedData: Record<string, any> = {};
    
    // Process each field to ensure it's properly formatted for the database
    for (const [key, value] of Object.entries(updateData)) {
      // Skip undefined values
      if (value === undefined) {
        continue;
      }
      
      // Handle special cases
      if (key === 'skills' || key === 'interests' || key === 'languages') {
        // Ensure arrays are properly formatted for PostgreSQL
        if (Array.isArray(value)) {
          sanitizedData[key] = value;
        } else if (value === null) {
          sanitizedData[key] = null;
        } else {
          // Skip invalid array values
          console.warn(`Invalid value for ${key}:`, value);
          continue;
        }
      } else if (key === 'gpa') {
        // Handle GPA - can be null or a number
        if (value === null) {
          sanitizedData[key] = null;
        } else if (value === '') {
          sanitizedData[key] = null;
        } else {
          const gpaValue = parseFloat(value as string);
          if (isNaN(gpaValue)) {
            console.warn(`Invalid GPA value:`, value);
            continue;
          }
          sanitizedData[key] = gpaValue;
        }
      } else if (key === 'check_profile_completion') {
        // This is a flag for the client, not a database field
        continue;
      } else {
        // For other fields, just pass the value as is
        sanitizedData[key] = value;
      }
    }
    
    // Check if we have any fields to update after sanitization
    const fields = Object.keys(sanitizedData);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Build the dynamic query with proper parameter references
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => sanitizedData[field]);
    
    // Add profile completion check if requested
    let profileCompleteClause = '';
    if (updateData.check_profile_completion) {
      // Boolean flag for basic profile completeness
      profileCompleteClause = `, profile_complete = (
        CASE WHEN 
          full_name IS NOT NULL AND 
          phone IS NOT NULL AND 
          location IS NOT NULL AND 
          bio IS NOT NULL AND 
          (skills IS NOT NULL AND array_length(skills, 1) > 0)
        THEN TRUE ELSE FALSE END
      )`;
      
      // Calculate profile completion percentage
      // We need to fetch the current user data to calculate the percentage
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length > 0) {
        const user = { ...userResult.rows[0], ...sanitizedData };
        const percentage = calculateProfileCompletion(user);
        
        // Add the percentage to the SET clause
        profileCompleteClause += `, profile_completion_percentage = ${percentage}`;
      }
    }
    
    const query = `
      UPDATE users 
      SET ${setClause}${profileCompleteClause}, updated_at = NOW() 
      WHERE id = $1 
      RETURNING id, email, full_name, role, avatar_url, phone, location, address, bio, 
        website, linkedin_url, github_url, instagram_url, twitter_url, portfolio_url, 
        university, major, graduation_year, gpa, skills, interests, languages, 
        company_name, company_size, industry, company_description, profile_complete, 
        profile_completion_percentage, verified, created_at, updated_at
    `;

    console.log('Executing query:', query);
    console.log('Query parameters:', [userId, ...values]);
    
    const result = await pool.query(query, [userId, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    
    // Provide more detailed error information
    if (error.code === '22P02') {
      return res.status(400).json({ 
        error: 'Invalid input data type',
        details: error.message
      });
    } else if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Duplicate value violates unique constraint',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get all users (admin only)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT id, email, full_name, role, avatar_url, phone, location, address, bio, website, linkedin_url, github_url, instagram_url, twitter_url, portfolio_url, university, major, graduation_year, gpa, skills, interests, languages, company_name, company_size, industry, company_description, profile_complete, profile_completion_percentage, verified, created_at, updated_at FROM users';
    let countQuery = 'SELECT COUNT(*) FROM users';
    const queryParams: any[] = [];
    const conditions: string[] = [];

    if (role) {
      conditions.push(`role = $${queryParams.length + 1}`);
      queryParams.push(role);
    }

    if (search) {
      conditions.push(`(full_name ILIKE $${queryParams.length + 1} OR email ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(Number(limit), offset);

    const [usersResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / Number(limit));

    res.json({
      users: usersResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalUsers,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, email, full_name, role, avatar_url, phone, location, address, bio, website, linkedin_url, github_url, instagram_url, twitter_url, portfolio_url, university, major, graduation_year, gpa, skills, interests, languages, company_name, company_size, industry, company_description, profile_complete, verified, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user by ID (admin only)
router.put('/:id', authenticateToken, [
  body('full_name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().custom(value => {
    if (!value) return true; // Allow empty values
    
    // Remove all non-digit characters for validation
    const digitsOnly = value.replace(/\D/g, '');
    
    // Check if we have a reasonable number of digits for a phone number (7-15 digits)
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }),
  body('website').optional().custom((value) => {
    if (value && value.trim() !== '') {
      return validator.isURL(value);
    }
    return true;
  }),
  body('linkedin_url').optional().custom((value) => {
    if (value && value.trim() !== '') {
      return validator.isURL(value);
    }
    return true;
  }),
  body('github_url').optional().custom((value) => {
    if (value && value.trim() !== '') {
      return validator.isURL(value);
    }
    return true;
  }),
  body('gpa').optional().custom((value) => {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 10; // Allowing GPA up to 10 to accommodate different scales
  }),
  body('verified').optional().isBoolean(),
], async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData: UpdateUserData = req.body;

    // Process the update data
    const sanitizedData: Record<string, any> = {};
    
    // Handle the check_profile_completion flag
    const checkProfileCompletion = updateData.check_profile_completion;
    
    // Remove the flag from the update data as it's not a database field
    delete updateData.check_profile_completion;
    
    // Process each field to ensure it's properly formatted for the database
    for (const [key, value] of Object.entries(updateData)) {
      // Skip undefined values
      if (value === undefined) {
        continue;
      }
      
      // Handle special cases
      if (key === 'skills' || key === 'interests' || key === 'languages') {
        // Ensure arrays are properly formatted for PostgreSQL
        if (Array.isArray(value)) {
          sanitizedData[key] = value;
        } else if (value === null) {
          sanitizedData[key] = null;
        } else {
          // Skip invalid array values
          console.warn(`Invalid value for ${key}:`, value);
          continue;
        }
      } else if (key === 'gpa') {
        // Handle GPA - can be null or a number
        if (value === null) {
          sanitizedData[key] = null;
        } else if (value === '') {
          sanitizedData[key] = null;
        } else {
          const gpaValue = parseFloat(value as string);
          if (isNaN(gpaValue)) {
            console.warn(`Invalid GPA value:`, value);
            continue;
          }
          sanitizedData[key] = gpaValue;
        }
      } else {
        // For other fields, just pass the value as is
        sanitizedData[key] = value;
      }
    }
    
    // Build dynamic query
    const fields = Object.keys(sanitizedData);
    const values = Object.values(sanitizedData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add profile completion check if requested
    let profileCompleteClause = '';
    if (checkProfileCompletion) {
      // Boolean flag for basic profile completeness
      profileCompleteClause = `, profile_complete = (
        CASE WHEN 
          full_name IS NOT NULL AND 
          phone IS NOT NULL AND 
          location IS NOT NULL AND 
          bio IS NOT NULL AND 
          (skills IS NOT NULL AND array_length(skills, 1) > 0)
        THEN TRUE ELSE FALSE END
      )`;
      
      // Calculate profile completion percentage
      // We need to fetch the current user data to calculate the percentage
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      
      if (userResult.rows.length > 0) {
        const user = { ...userResult.rows[0], ...sanitizedData };
        const percentage = calculateProfileCompletion(user);
        
        // Add the percentage to the SET clause
        profileCompleteClause += `, profile_completion_percentage = ${percentage}`;
      }
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE users SET ${setClause}${profileCompleteClause}, updated_at = NOW() WHERE id = $1 RETURNING id, email, full_name, role, avatar_url, phone, location, address, bio, website, linkedin_url, github_url, instagram_url, twitter_url, portfolio_url, university, major, graduation_year, gpa, skills, interests, languages, company_name, company_size, industry, company_description, profile_complete, profile_completion_percentage, verified, created_at, updated_at`;

    console.log('Executing query:', query);
    console.log('Query parameters:', [id, ...values]);
    
    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Update user by ID error:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    // Provide more detailed error information
    if (error.code === '22P02') {
      return res.status(400).json({ 
        error: 'Invalid input data type',
        details: error.message
      });
    } else if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Duplicate value violates unique constraint',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;