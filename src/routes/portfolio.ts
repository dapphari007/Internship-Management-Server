import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type {
  CreateUserExperienceData,
  CreateUserProjectData,
  CreateUserAchievementData,
  UpdateUserExperienceData,
  UpdateUserProjectData,
  UpdateUserAchievementData
} from '../models/UserPortfolio.js';

const router = express.Router();

// Get all user experiences
router.get('/experiences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await pool.query(
      'SELECT * FROM user_experiences WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user experiences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new experience
router.post('/experiences', authenticateToken, [
  body('title').notEmpty().withMessage('Title is required'),
  body('company').notEmpty().withMessage('Company is required'),
  body('duration').notEmpty().withMessage('Duration is required'),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user?.id;
    const experienceData: CreateUserExperienceData = req.body;
    
    const result = await pool.query(
      'INSERT INTO user_experiences (user_id, title, company, duration, description, skills) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        userId,
        experienceData.title,
        experienceData.company,
        experienceData.duration,
        experienceData.description || null,
        experienceData.skills || null
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user experience:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an experience
router.put('/experiences/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const experienceId = req.params.id;
    const updateData: UpdateUserExperienceData = req.body;
    
    // Check if the experience exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM user_experiences WHERE id = $1 AND user_id = $2',
      [experienceId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Experience not found or not authorized' });
    }
    
    // Build dynamic query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
    const query = `UPDATE user_experiences SET ${setClause}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`;
    
    const result = await pool.query(query, [experienceId, userId, ...values]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user experience:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an experience
router.delete('/experiences/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const experienceId = req.params.id;
    
    // Check if the experience exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM user_experiences WHERE id = $1 AND user_id = $2',
      [experienceId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Experience not found or not authorized' });
    }
    
    await pool.query(
      'DELETE FROM user_experiences WHERE id = $1 AND user_id = $2',
      [experienceId, userId]
    );
    
    res.json({ message: 'Experience deleted successfully' });
  } catch (error) {
    console.error('Error deleting user experience:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all user projects
router.get('/projects', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await pool.query(
      'SELECT * FROM user_projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project
router.post('/projects', authenticateToken, [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user?.id;
    const projectData: CreateUserProjectData = req.body;
    
    const result = await pool.query(
      'INSERT INTO user_projects (user_id, title, description, technologies, link, status, experience, achievements) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [
        userId,
        projectData.title,
        projectData.description || null,
        projectData.technologies || null,
        projectData.link || null,
        projectData.status || 'In Progress',
        projectData.experience || null,
        projectData.achievements || null
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
router.put('/projects/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const projectId = req.params.id;
    const updateData: UpdateUserProjectData = req.body;
    
    // Check if the project exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM user_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or not authorized' });
    }
    
    // Build dynamic query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
    const query = `UPDATE user_projects SET ${setClause}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`;
    
    const result = await pool.query(query, [projectId, userId, ...values]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project
router.delete('/projects/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const projectId = req.params.id;
    
    // Check if the project exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM user_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or not authorized' });
    }
    
    await pool.query(
      'DELETE FROM user_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting user project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all user achievements
router.get('/achievements', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await pool.query(
      'SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new achievement
router.post('/achievements', authenticateToken, [
  body('title').notEmpty().withMessage('Title is required'),
  body('issuer').notEmpty().withMessage('Issuer is required'),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user?.id;
    const achievementData: CreateUserAchievementData = req.body;
    
    const result = await pool.query(
      'INSERT INTO user_achievements (user_id, title, issuer, date, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        userId,
        achievementData.title,
        achievementData.issuer,
        achievementData.date || null,
        achievementData.description || null
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user achievement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an achievement
router.put('/achievements/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const achievementId = req.params.id;
    const updateData: UpdateUserAchievementData = req.body;
    
    // Check if the achievement exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM user_achievements WHERE id = $1 AND user_id = $2',
      [achievementId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Achievement not found or not authorized' });
    }
    
    // Build dynamic query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
    const query = `UPDATE user_achievements SET ${setClause}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`;
    
    const result = await pool.query(query, [achievementId, userId, ...values]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user achievement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an achievement
router.delete('/achievements/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const achievementId = req.params.id;
    
    // Check if the achievement exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM user_achievements WHERE id = $1 AND user_id = $2',
      [achievementId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Achievement not found or not authorized' });
    }
    
    await pool.query(
      'DELETE FROM user_achievements WHERE id = $1 AND user_id = $2',
      [achievementId, userId]
    );
    
    res.json({ message: 'Achievement deleted successfully' });
  } catch (error) {
    console.error('Error deleting user achievement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all portfolio data (experiences, projects, achievements) in one request
router.get('/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const [experiencesResult, projectsResult, achievementsResult] = await Promise.all([
      pool.query('SELECT * FROM user_experiences WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      pool.query('SELECT * FROM user_projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      pool.query('SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY created_at DESC', [userId])
    ]);
    
    res.json({
      experiences: experiencesResult.rows,
      projects: projectsResult.rows,
      achievements: achievementsResult.rows
    });
  } catch (error) {
    console.error('Error fetching user portfolio data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;