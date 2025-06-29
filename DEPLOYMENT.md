# Deployment Guide for Internship Platform Backend

## Render Deployment Configuration

### Service Settings
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start` 
- **Root Directory**: `server`
- **Node.js Version**: 18.x or later

### Required Environment Variables

Set these in your Render dashboard:

```bash
# Server Configuration
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://postgres:qPJROLwbsKxm58So@db.slrciplnmbgrgxorrvdw.supabase.co:5432/postgres

# Security
JWT_SECRET=231f590d30dcbdec718adb40d848cbf1ec9f79a4b9c112d40068ea02f3120db277bd19b71b469287205f14f3a4fc7ef7dac6c5c062fa62492364f620450816d61

# CORS
CLIENT_URL=https://your-frontend-domain.onrender.com
```

### Optional Environment Variables
```bash
# File Upload (if using Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (if using notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## Health Check

Once deployed, test these endpoints:
- `GET /` - API information
- `GET /health` - Health check
- `GET /api/auth/test` - API test (if available)

## Database Setup

The application uses PostgreSQL with Supabase. Make sure:
1. Database URL is correctly set
2. Database has proper permissions
3. Required tables are created (run migrations if needed)

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check database permissions
- Ensure SSL is properly configured

### Build Failures
- Make sure all dependencies are in the correct sections
- TypeScript and @types/node are in `dependencies`
- Check for syntax errors in TypeScript files

### CORS Issues
- Set `CLIENT_URL` to your frontend domain
- Ensure frontend is making requests to correct API URL
