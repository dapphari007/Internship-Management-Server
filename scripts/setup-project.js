#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Setting up Internship Platform Server...\n');

// Function to run commands
function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ Error during ${description}:`, error.message);
    process.exit(1);
  }
}

// Function to check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Function to copy env files
function setupEnvFiles() {
  console.log('🔧 Setting up environment files...');
  
  // Server .env
  const serverEnvExample = path.join(__dirname, '..', '.env.example');
  const serverEnv = path.join(__dirname, '..', '.env');
  
  if (fileExists(serverEnvExample) && !fileExists(serverEnv)) {
    fs.copyFileSync(serverEnvExample, serverEnv);
    console.log('✅ Server .env file created from .env.example');
  }
  
  // Client .env
  const clientEnvExample = path.join(__dirname, '..', '..', 'client', '.env.example');
  const clientEnv = path.join(__dirname, '..', '..', 'client', '.env');
  
  if (fileExists(clientEnvExample) && !fileExists(clientEnv)) {
    fs.copyFileSync(clientEnvExample, clientEnv);
    console.log('✅ Client .env file created from .env.example');
  }
  
  console.log('');
}

// Main setup process
async function setup() {
  try {
    // Install server dependencies
    runCommand('npm install', 'Installing server dependencies');
    
    // Install client dependencies
    runCommand('cd ../client && npm install', 'Installing client dependencies');
    
    // Setup environment files
    setupEnvFiles();
    
    console.log('🎉 Setup completed successfully!\n');
    console.log('📋 Next steps:');
    console.log('1. Set up PostgreSQL database:');
    console.log('   createdb internship_platform');
    console.log('');
    console.log('2. Update database credentials in server/.env file');
    console.log('');
    console.log('3. Run database migrations and seed data:');
    console.log('   npm run db:setup');
    console.log('');
    console.log('4. Start the development servers:');
    console.log('   Server: npm run dev (from server directory)');
    console.log('   Client: npm run dev (from client directory)');
    console.log('');
    console.log('🌐 The application will be available at:');
    console.log('   Frontend: http://localhost:5173');
    console.log('   Backend:  http://localhost:5000');
    console.log('');
    console.log('👤 Demo accounts:');
    console.log('   Admin:    admin@internshippro.com (password: admin123)');
    console.log('   Company:  hr@techcorp.com (password: company123)');
    console.log('   Student:  john.doe@stanford.edu (password: student123)');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();