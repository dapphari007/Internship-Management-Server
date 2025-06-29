import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import internshipRoutes from './routes/internships.js';
import applicationRoutes from './routes/applications.js';
import companyRoutes from './routes/companies.js';
import preferencesRoutes from './routes/preferences.js';
import taskRoutes from './routes/tasks.js';
import courseRoutes from './routes/courses.js';
import analyticsRoutes from './routes/analytics.js';
import messageRoutes from './routes/messages.js';
import searchRoutes from './routes/search.js';
import notificationRoutes from './routes/notifications.js';
import portfolioRoutes from './routes/portfolio.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// Import services
import NotificationService from './services/notificationService.js';
import { initializeNotificationsTable, checkNotificationsTable } from './utils/initNotifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Environment-specific rate limiting configuration
const isProduction = process.env.NODE_ENV === 'production';

// Define different rate limits for different endpoints
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 300 : 500, // Lower in production to reduce server load
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More permissive limiter for notification endpoints
const notificationsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isProduction ? 150 : 300, // Still limited but higher than standard
  message: 'Too many notification requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Very permissive limiter for health checks and static content
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 1 request per second on average
  message: 'Too many health check requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiter is already defined above
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Internship Platform API Server',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      users: '/api/users',
      internships: '/api/internships',
      applications: '/api/applications',
      companies: '/api/companies',
      tasks: '/api/tasks',
      courses: '/api/courses',
      analytics: '/api/analytics',
      messages: '/api/messages',
      search: '/api/search',
      notifications: '/api/notifications',
      portfolio: '/api/portfolio'
    }
  });
});

// Apply different rate limiters based on endpoint
app.use('/health', healthLimiter);
app.use('/api/notifications', notificationsLimiter);
app.use('/api', standardLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Initialize notifications table
  try {
    const tableExists = await checkNotificationsTable();
    if (!tableExists) {
      console.log('🔔 Notifications table not found, creating...');
      await initializeNotificationsTable();
    } else {
      console.log('✅ Notifications table already exists');
    }
  } catch (error) {
    console.error('❌ Failed to initialize notifications table:', error);
  }
  
  // Start notification service periodic checks
  NotificationService.startPeriodicChecks();
  console.log(`🔔 Notification service started`);
});