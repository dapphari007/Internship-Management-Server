import express from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { UpdateUserPreferencesData } from '../models/UserPreferences.js';

const router = express.Router();

// Get user preferences
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    
    // First check if preferences exist for this user
    let result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    // If no preferences exist, create default ones
    if (result.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_preferences (user_id) VALUES ($1)',
        [userId]
      );
      
      // Fetch the newly created preferences
      result = await pool.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [userId]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user preferences
router.put('/', authenticateToken, [
  body('profile_visibility').optional().isIn(['public', 'registered', 'private']),
  body('show_email').optional().isBoolean(),
  body('show_phone').optional().isBoolean(),
  body('show_location').optional().isBoolean(),
  body('allow_messages').optional().isBoolean(),
  body('show_online_status').optional().isBoolean(),
  body('searchable').optional().isBoolean(),
  body('email_notifications').optional().isBoolean(),
  body('push_notifications').optional().isBoolean(),
  body('task_reminders').optional().isBoolean(),
  body('application_updates').optional().isBoolean(),
  body('message_notifications').optional().isBoolean(),
  body('weekly_digest').optional().isBoolean(),
  body('marketing_emails').optional().isBoolean(),
  body('sound_enabled').optional().isBoolean(),
  body('desktop_notifications').optional().isBoolean(),
  body('two_factor_enabled').optional().isBoolean(),
  body('login_alerts').optional().isBoolean(),
  body('session_timeout').optional().isInt({ min: 5, max: 1440 }), // 5 minutes to 24 hours
  body('theme').optional().isIn(['light', 'dark', 'system']),
  body('language').optional().isLength({ min: 2, max: 10 }),
  body('timezone').optional().isLength({ min: 1, max: 50 }),
  body('date_format').optional().isLength({ min: 1, max: 20 }),
  body('compact_mode').optional().isBoolean(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData: UpdateUserPreferencesData = req.body;
    const userId = req.user?.id;

    // Build dynamic query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // First ensure preferences exist for this user
    await pool.query(
      'INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE user_preferences SET ${setClause}, updated_at = NOW() WHERE user_id = $1 RETURNING *`;

    const result = await pool.query(query, [userId, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preferences not found' });
    }

    res.json({
      message: 'Preferences updated successfully',
      preferences: result.rows[0],
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset preferences to default
router.post('/reset', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    // Delete existing preferences (will trigger creation of defaults on next fetch)
    await pool.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);

    // Create new default preferences
    const result = await pool.query(
      'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
      [userId]
    );

    res.json({
      message: 'Preferences reset to defaults successfully',
      preferences: result.rows[0],
    });
  } catch (error) {
    console.error('Reset preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;