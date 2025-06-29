import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Use DATABASE_URL for production (Render, Heroku, etc.) or individual config for development
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' 
          ? { rejectUnauthorized: false } 
          : false,
        // Optimized pool settings for Transaction Pooler
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'internship_platform',
        password: process.env.DB_PASSWORD || 'admin',
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: false,
        // Local development pool settings
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
  console.log(`🔗 Database URL: ${process.env.DATABASE_URL ? 'Using DATABASE_URL' : 'Using individual config'}`);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  console.error('Database configuration:', {
    usingDatabaseUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
  });
  process.exit(-1);
});

// Test initial connection
pool.connect()
  .then(() => console.log('🚀 Initial database connection successful'))
  .catch((err) => {
    console.error('💥 Initial database connection failed:', err);
    console.error('Database configuration:', {
      usingDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      databaseUrlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not set'
    });
  });

export default pool;