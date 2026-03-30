// setupCheck.js - Run this to verify your About module setup
// Usage: node setupCheck.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking About Module Setup...\n');

const checks = [];

// 1. Check if model exists
const modelPath = path.join(__dirname, 'models', 'About.js');
if (fs.existsSync(modelPath)) {
  checks.push({ name: 'About Model', status: '✅', path: modelPath });
} else {
  checks.push({ name: 'About Model', status: '❌', path: modelPath, error: 'File not found' });
}

// 2. Check if controller exists
const controllerPath = path.join(__dirname, 'controllers', 'aboutController.js');
if (fs.existsSync(controllerPath)) {
  checks.push({ name: 'About Controller', status: '✅', path: controllerPath });
} else {
  checks.push({ name: 'About Controller', status: '❌', path: controllerPath, error: 'File not found' });
}

// 3. Check if routes exist
const routesPath = path.join(__dirname, 'routes', 'about.js');
if (fs.existsSync(routesPath)) {
  checks.push({ name: 'About Routes', status: '✅', path: routesPath });
} else {
  checks.push({ name: 'About Routes', status: '❌', path: routesPath, error: 'File not found' });
}

// 4. Check if uploads directory exists
const uploadsPath = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsPath)) {
  checks.push({ name: 'Uploads Directory', status: '✅', path: uploadsPath });
} else {
  checks.push({ name: 'Uploads Directory', status: '⚠️', path: uploadsPath, error: 'Directory not found - will be created on first upload' });
  // Create it
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('✅ Created uploads directory\n');
  } catch (err) {
    console.log('❌ Failed to create uploads directory:', err.message, '\n');
  }
}

// 5. Check main app file for route registration
const possibleAppFiles = ['app.js', 'server.js', 'index.js'];
let appFile = null;
let routeRegistered = false;

for (const file of possibleAppFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    appFile = filePath;
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if about routes are imported and used
    const hasImport = content.includes("require('./routes/about')") || 
                     content.includes('require("./routes/about")') ||
                     content.includes("from './routes/about'") ||
                     content.includes('from "./routes/about"');
    
    const hasUse = content.includes("app.use('/api/about'") || 
                   content.includes('app.use("/api/about"');
    
    if (hasImport && hasUse) {
      routeRegistered = true;
      checks.push({ name: 'Route Registration', status: '✅', path: filePath });
    }
    break;
  }
}

if (!routeRegistered) {
  checks.push({ 
    name: 'Route Registration', 
    status: '❌', 
    path: appFile || 'Not found', 
    error: 'Routes not registered in main app file' 
  });
}

// Print results
console.log('📋 Setup Check Results:\n');
checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
  if (check.error) {
    console.log(`   ⚠️  ${check.error}`);
  }
  console.log(`   📁 ${check.path}`);
  console.log('');
});

// Summary
const passed = checks.filter(c => c.status === '✅').length;
const total = checks.length;

console.log('\n' + '='.repeat(50));
console.log(`Summary: ${passed}/${total} checks passed`);
console.log('='.repeat(50) + '\n');

if (passed === total) {
  console.log('✅ All checks passed! Your About module setup looks good.\n');
  console.log('Next steps:');
  console.log('1. Start your server: npm start');
  console.log('2. Test the endpoint: curl http://localhost:5000/api/about');
  console.log('3. Create about content via admin panel\n');
} else {
  console.log('❌ Some checks failed. Please review the errors above.\n');
  
  if (!routeRegistered) {
    console.log('🔧 To fix route registration, add this to your main app file:\n');
    console.log('const aboutRoutes = require(\'./routes/about\');');
    console.log('app.use(\'/api/about\', aboutRoutes);\n');
    console.log('⚠️  Make sure this is BEFORE any catch-all routes or error handlers!\n');
  }
}

// Additional checks
console.log('\n📦 Additional Information:\n');

// Check if express-validator is installed
try {
  require.resolve('express-validator');
  console.log('✅ express-validator is installed');
} catch (e) {
  console.log('❌ express-validator not found - run: npm install express-validator');
}

// Check if multer is installed
try {
  require.resolve('multer');
  console.log('✅ multer is installed');
} catch (e) {
  console.log('❌ multer not found - run: npm install multer');
}

// Check if express-rate-limit is installed
try {
  require.resolve('express-rate-limit');
  console.log('✅ express-rate-limit is installed');
} catch (e) {
  console.log('❌ express-rate-limit not found - run: npm install express-rate-limit');
}

console.log('\n' + '='.repeat(50) + '\n');