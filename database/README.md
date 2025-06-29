# Database Setup Guide

This directory contains all database-related files for the Internship Management Platform.

## Files Overview

### Core Files
- **`schema.sql`** - Database structure (tables, indexes, constraints)
- **`seed.sql`** - Development demo data with test accounts
- **`seed-production.sql`** - Production-ready minimal seed data

### Scripts
- **`src/scripts/migrate.ts`** - Runs database migrations
- **`src/scripts/seed.ts`** - Seeds demo data
- **`src/scripts/setup.ts`** - Comprehensive setup script

## Quick Start

### Development Setup
```bash
# Complete setup (migrate + seed with demo data)
npm run db:setup

# Reset database (clear all data and re-seed)
npm run db:reset

# Force setup (override existing data)
npm run db:setup:force
```

### Individual Commands
```bash
# Only run migrations (create tables)
npm run db:migrate

# Only seed demo data
npm run db:seed
```

### Production Setup
```bash
# Setup without demo data
NODE_ENV=production npm run db:setup

# Setup with minimal production data
npm run db:setup -- --seed
```

## Demo Accounts (Development Only)

When using `seed.sql`, these test accounts are created:

### Admin Account
- **Email:** admin@internshippro.com
- **Password:** admin123
- **Role:** Admin (full platform access)

### Company Account
- **Email:** hr@techcorp.com
- **Password:** company123
- **Role:** Company (can post internships)

### Student Accounts
- **Email:** john.doe@stanford.edu | **Password:** student123
- **Email:** jane.smith@mit.edu | **Password:** student123
- **Email:** mike.johnson@berkeley.edu | **Password:** student123
- **Role:** Student (can apply for internships)

## Database Schema

### Main Tables
- **users** - User accounts and profiles
- **companies** - Company information and profiles
- **internships** - Internship postings
- **applications** - Student applications to internships
- **messages** - Communication between users
- **tasks** - Task management system

## Environment-Specific Behavior

### Development (`NODE_ENV=development`)
- Automatically seeds demo data
- Creates test accounts
- Includes sample internships and applications

### Production (`NODE_ENV=production`)
- Only runs migrations by default
- Requires explicit `--seed` flag for seeding
- Uses `seed-production.sql` for minimal essential data

## Advanced Usage

### Custom Setup Options
```bash
# Show help
npm run db:setup -- --help

# Force re-seed in production
NODE_ENV=production npm run db:setup -- --seed --force

# Only migrate without seeding
npm run db:migrate
```

### Manual Database Operations
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d internship_platform

# Check tables
\dt

# View users
SELECT email, role FROM users;
```

## Security Notes

⚠️ **Important for Production:**
1. Change default admin password immediately
2. Use strong, unique passwords
3. Enable SSL connections
4. Restrict database access
5. Regular backups

## Troubleshooting

### Common Issues
1. **Connection refused** - Check if PostgreSQL is running
2. **Permission denied** - Verify database credentials
3. **Table already exists** - Use `--force` flag to reset

### Reset Everything
```bash
# Nuclear option - completely reset database
npm run db:reset
```