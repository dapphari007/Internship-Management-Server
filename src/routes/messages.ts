import { Router } from 'express';
import type { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import NotificationService from '../services/notificationService.js';

const router = Router();

// Get conversations for the current user
router.get('/conversations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const query = `
      WITH conversation_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END as other_user_id,
          MAX(created_at) as last_message_time,
          COUNT(*) FILTER (WHERE recipient_id = $1 AND read_at IS NULL) as unread_count
        FROM messages 
        WHERE sender_id = $1 OR recipient_id = $1
        GROUP BY other_user_id
      ),
      latest_messages AS (
        SELECT DISTINCT ON (
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END
        )
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END as other_user_id,
          content as last_message,
          created_at
        FROM messages 
        WHERE sender_id = $1 OR recipient_id = $1
        ORDER BY 
          CASE 
            WHEN sender_id = $1 THEN recipient_id 
            ELSE sender_id 
          END,
          created_at DESC
      )
      SELECT 
        u.id,
        u.full_name,
        u.role,
        u.avatar_url,
        cm.last_message_time,
        cm.unread_count,
        lm.last_message,
        CASE WHEN u.updated_at > NOW() - INTERVAL '5 minutes' THEN true ELSE false END as is_online
      FROM conversation_messages cm
      JOIN users u ON u.id = cm.other_user_id
      JOIN latest_messages lm ON lm.other_user_id = cm.other_user_id
      ORDER BY cm.last_message_time DESC
    `;

    const result = await pool.query(query, [userId]);
    
    const conversations = result.rows.map((row: any) => ({
      id: row.id,
      participantId: row.id,
      participantName: row.full_name,
      participantRole: row.role,
      participantAvatar: row.avatar_url,
      lastMessage: row.last_message,
      lastMessageTime: row.last_message_time,
      unreadCount: parseInt(row.unread_count) || 0,
      isOnline: row.is_online
    }));

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const otherUserId = req.params.userId;

    const query = `
      SELECT 
        m.id,
        m.sender_id,
        m.content,
        m.created_at,
        m.read_at,
        u.full_name as sender_name,
        u.role as sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE 
        (m.sender_id = $1 AND m.recipient_id = $2) OR 
        (m.sender_id = $2 AND m.recipient_id = $1)
      ORDER BY m.created_at ASC
    `;

    const result = await pool.query(query, [currentUserId, otherUserId]);
    
    const messages = result.rows.map((row: any) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderRole: row.sender_role,
      content: row.content,
      timestamp: row.created_at,
      isRead: row.read_at !== null
    }));

    // Mark messages as read
    await pool.query(
      'UPDATE messages SET read_at = NOW() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [otherUserId, currentUserId]
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
router.post('/send', [
  authenticateToken,
  body('recipientId').isUUID().withMessage('Valid recipient ID is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Message content is required'),
  body('subject').optional().trim().isLength({ max: 255 }).withMessage('Subject too long')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const senderId = req.user?.id;
    const { recipientId, content, subject } = req.body;

    // Check if recipient exists
    const recipientCheck = await pool.query('SELECT id FROM users WHERE id = $1', [recipientId]);
    if (recipientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const query = `
      INSERT INTO messages (sender_id, recipient_id, subject, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;

    const result = await pool.query(query, [senderId, recipientId, subject, content]);
    const message = result.rows[0];

    // Get sender info for response
    const senderQuery = await pool.query(
      'SELECT full_name, role FROM users WHERE id = $1',
      [senderId]
    );
    const sender = senderQuery.rows[0];

    // Send notification to recipient
    try {
      await NotificationService.notifyNewMessage(recipientId, sender.full_name, subject);
    } catch (notificationError) {
      console.error('Failed to send message notification:', notificationError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      id: message.id,
      senderId,
      senderName: sender.full_name,
      senderRole: sender.role,
      content,
      timestamp: message.created_at,
      isRead: false
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get all users for new message (excluding current user)
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { search } = req.query;

    let query = `
      SELECT id, full_name, role, avatar_url
      FROM users 
      WHERE id != $1
    `;
    const params = [currentUserId];

    if (search) {
      query += ` AND full_name ILIKE $2`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY full_name ASC LIMIT 20`;

    const result = await pool.query(query, params);
    
    const users = result.rows.map((row: any) => ({
      id: row.id,
      name: row.full_name,
      role: row.role,
      avatar: row.avatar_url
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Mark messages as read
router.put('/mark-read/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const otherUserId = req.params.userId;

    await pool.query(
      'UPDATE messages SET read_at = NOW() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [otherUserId, currentUserId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;