// ===================================================
// scripts/test-connection.js - MongoDB Connection Test
// ===================================================
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  console.log('🔍 Testing MongoDB Connection...\n');
  
  // Display environment info
  console.log('Environment Information:');
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('- MONGODB_URI:', process.env.MONGODB_URI || 'Not set');
  console.log('- Port:', process.env.PORT || 5000);
  console.log('');
  
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is not set!');
    console.log('\n💡 Solutions:');
    console.log('1. Make sure your .env file exists in the root directory');
    console.log('2. Add MONGODB_URI=mongodb://localhost:27017/portfolio to your .env file');
    console.log('3. If using MongoDB Atlas, use the connection string from your cluster');
    process.exit(1);
  }
  
  console.log('🔗 Attempting to connect to MongoDB...');
  
  try {
    // Connection options
    const options = {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      socketTimeoutMS: 10000,
      bufferCommands: false,
      bufferMaxEntries: 0
    };
    
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log('✅ MongoDB connection successful!');
    console.log('- Host:', mongoose.connection.host);
    console.log('- Database:', mongoose.connection.name);
    console.log('- Port:', mongoose.connection.port);
    console.log('- Ready State:', mongoose.connection.readyState);
    
    // Test database operations
    console.log('\n🧪 Testing database operations...');
    
    // Try to ping the database
    const adminDb = mongoose.connection.db.admin();
    const pingResult = await adminDb.ping();
    console.log('✅ Database ping successful:', pingResult);
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Available collections:', collections.length);
    
    if (collections.length > 0) {
      console.log('Collections:', collections.map(c => c.name).join(', '));
    }
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Connection test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed!');
    console.error('Error:', error.message);
    
    // Provide specific troubleshooting based on error type
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Troubleshooting ECONNREFUSED:');
      console.log('1. Make sure MongoDB is running on your system');
      console.log('2. Check if MongoDB service is started:');
      console.log('   - Windows: Check Services or run `net start mongodb`');
      console.log('   - macOS: Run `brew services start mongodb-community`');
      console.log('   - Linux: Run `sudo systemctl start mongod`');
      console.log('3. Verify the connection string in your .env file');
      console.log('4. Check if the port 27017 is available and not blocked');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Troubleshooting ENOTFOUND:');
      console.log('1. Check your internet connection (if using MongoDB Atlas)');
      console.log('2. Verify the hostname in your connection string');
      console.log('3. Make sure your IP is whitelisted (if using MongoDB Atlas)');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 Troubleshooting Authentication:');
      console.log('1. Check your username and password in the connection string');
      console.log('2. Make sure the user has proper permissions');
      console.log('3. Verify the database name in the connection string');
    }
    
    console.log('\n📋 Connection String Format Examples:');
    console.log('- Local: mongodb://localhost:27017/portfolio');
    console.log('- Atlas: mongodb+srv://username:password@cluster.mongodb.net/portfolio');
    console.log('- With Auth: mongodb://username:password@localhost:27017/portfolio');
    
    process.exit(1);
  }
}

// Run the test
testConnection();

// ===================================================
// scripts/check-env.js - Environment Variables Check
// ===================================================

// Alternative script to check environment setup
function checkEnvironment() {
  console.log('🔍 Checking Environment Configuration...\n');
  
  const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'NODE_ENV'
  ];
  
  const optionalVars = [
    'PORT',
    'FRONTEND_URL',
    'ENABLE_RATE_LIMITING',
    'LOG_LEVEL'
  ];
  
  console.log('📋 Required Environment Variables:');
  let allRequired = true;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    console.log(`${status} ${varName}: ${value ? '***set***' : 'NOT SET'}`);
    if (!value) allRequired = false;
  });
  
  console.log('\n📋 Optional Environment Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '⚠️ ';
    console.log(`${status} ${varName}: ${value || 'Using default'}`);
  });
  
  console.log('\n📁 Environment File Check:');
  const fs = require('fs');
  const path = require('path');
  
  const envPath = path.join(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);
  
  console.log(`${envExists ? '✅' : '❌'} .env file: ${envExists ? 'Found' : 'NOT FOUND'}`);
  
  if (!envExists) {
    console.log('\n💡 Creating .env file template...');
    const envTemplate = `# Portfolio API Environment Variables
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/portfolio
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=http://localhost:3000
ENABLE_RATE_LIMITING=false
LOG_LEVEL=info
`;
    
    try {
      fs.writeFileSync(envPath, envTemplate);
      console.log('✅ .env template created! Please update the values as needed.');
    } catch (error) {
      console.error('❌ Failed to create .env template:', error.message);
    }
  }
  
  if (!allRequired) {
    console.log('\n❌ Some required environment variables are missing!');
    process.exit(1);
  } else {
    console.log('\n✅ Environment configuration looks good!');
  }
}

// Export for use as module
module.exports = { testConnection, checkEnvironment };