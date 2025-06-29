import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'student' | 'company' | 'admin';
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.error('Authentication failed: No token provided');
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      console.log('Token decoded successfully for user ID:', decoded.userId);
      
      if (!decoded.userId) {
        console.error('Authentication failed: Token missing userId');
        res.status(401).json({ error: 'Invalid token format' });
        return;
      }
      
      // Get user from database
      console.log('Querying database for user ID:', decoded.userId);
      const result = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        console.error('Authentication failed: User not found in database for ID:', decoded.userId);
        res.status(401).json({ error: 'Invalid token - user not found' });
        return;
      }

      req.user = result.rows[0];
      // Since we've verified result.rows has data, we can safely assert req.user is defined
      console.log('User authenticated successfully:', req.user!.id, req.user!.role);
      next();
    } catch (jwtError: any) {
      console.error('JWT verification failed:', jwtError.message);
      res.status(403).json({ error: 'Invalid or expired token', message: jwtError.message });
      return;
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Authentication error', message: error.message });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};