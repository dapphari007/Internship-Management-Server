import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Interface for notification clients
interface NotificationClients {
  notificationClients?: Map<number, { res: Response; userId: string; userRole: string }>;
}

// SSE endpoint for real-time notifications
router.get('/stream', authenticateToken, (req: AuthRequest, res: Response) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const user = req.user;
  if (!user || !user.id) {
    res.end(`data: ${JSON.stringify({ type: 'error', message: 'Authentication required' })}\n\n`);
    return;
  }

  const clientId = Date.now();
  console.log(`Client ${clientId} connected to notifications stream for user ${user.id}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to notifications' })}\n\n`);

  // Store client connection (in production, use Redis or similar)
  const globalWithClients = global as typeof global & NotificationClients;
  const clients = globalWithClients.notificationClients || new Map<number, { res: Response; userId: string; userRole: string }>();
  
  // Clean up any existing connections for this user to prevent memory leaks
  for (const [existingId, client] of clients.entries()) {
    if (client.userId === user.id && existingId !== clientId) {
      try {
        // Send a reconnect message to the old connection
        client.res.write(`data: ${JSON.stringify({ type: 'reconnected', message: 'Connected from another session' })}\n\n`);
        client.res.end();
        clients.delete(existingId);
        console.log(`Closed previous connection ${existingId} for user ${user.id}`);
      } catch (error) {
        console.error(`Error closing previous connection ${existingId}:`, error);
        clients.delete(existingId);
      }
    }
  }
  
  // Add the new connection
  clients.set(clientId, { res, userId: user.id, userRole: user.role || '' });
  globalWithClients.notificationClients = clients;

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    } catch (error) {
      console.error(`Error sending heartbeat to client ${clientId}:`, error);
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected from notifications`);
  });

  req.on('error', (err) => {
    console.error(`Error on client ${clientId} connection:`, err);
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

// Get user notifications
router.get('/', 
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('unread_only').optional().isBoolean().withMessage('unread_only must be a boolean'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { page = 1, limit = 20, unread_only = false } = req.query;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT n.*, 
               CASE 
                 WHEN n.action_url IS NOT NULL THEN n.action_url
                 ELSE NULL
               END as action_url
        FROM notifications n
        WHERE n.user_id = $1
      `;

      const queryParams = [user.id];

      if (unread_only === 'true') {
        query += ` AND n.read_at IS NULL`;
      }

      query += ` ORDER BY n.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(String(limit), String(offset));

      const result = await pool.query(query, queryParams);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM notifications WHERE user_id = $1`;
      const countParams = [user.id];

      if (unread_only === 'true') {
        countQuery += ` AND read_at IS NULL`;
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        notifications: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'UPDATE notifications SET read_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING *',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found or already read' });
    }

    res.json({ message: 'Notification marked as read', notification: result.rows[0] });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'UPDATE notifications SET read_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [user.id]
    );

    res.json({ 
      message: 'All notifications marked as read', 
      updatedCount: result.rowCount 
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// Clear all notifications (must come before /:id route)
router.delete('/clear-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [user.id]
    );

    res.json({ 
      message: 'All notifications cleared', 
      deletedCount: result.rowCount 
    });

  } catch (error) {
    console.error('Clear all notifications error:', error);
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [user.id]
    );

    res.json({ unreadCount: parseInt(result.rows[0].count) });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utility function to send notification to specific user
export const sendNotificationToUser = async (
  userId: string, 
  title: string, 
  message: string, 
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  actionUrl?: string
) => {
  try {
    // Save to database
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, action_url, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [userId, title, message, type, actionUrl]
    );

    const notification = result.rows[0];

    // Send via SSE to connected clients
    const globalWithClients = global as typeof global & NotificationClients;
    const clients = globalWithClients.notificationClients || new Map<number, { res: Response; userId: string; userRole: string }>();
    for (const [clientId, client] of clients.entries()) {
      if (client.userId === userId) {
        try {
          client.res.write(`data: ${JSON.stringify({
            type: 'notification',
            notification: {
              ...notification,
              timestamp: notification.created_at
            }
          })}\n\n`);
        } catch (error) {
          console.error(`Error sending notification to client ${clientId}:`, error);
          clients.delete(clientId);
        }
      }
    }

    return notification;
  } catch (error) {
    console.error('Send notification error:', error);
    throw error;
  }
};

// Utility function to broadcast notification to all users of a specific role
export const broadcastNotificationToRole = async (
  role: 'student' | 'company' | 'admin',
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  actionUrl?: string
) => {
  try {
    // Get all users with the specified role
    const usersResult = await pool.query(
      'SELECT id FROM users WHERE role = $1',
      [role]
    );

    const notifications = [];
    for (const user of usersResult.rows) {
      const notification = await sendNotificationToUser(user.id, title, message, type, actionUrl);
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error('Broadcast notification error:', error);
    throw error;
  }
};

export default router;