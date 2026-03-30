const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Admin Schema (exactly matching your model)
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, {
  timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
adminSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Check if account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

const Admin = mongoose.model('Admin', adminSchema);

async function debugAdminLogin() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    console.log('✅ Connected to MongoDB');

    // Check all admins in database
    console.log('\n📋 Checking all admins in database:');
    const allAdmins = await Admin.find({});
    console.log(`Total admins found: ${allAdmins.length}`);

    if (allAdmins.length === 0) {
      console.log('❌ No admins found! Creating default admin...');
      
      const defaultAdmin = new Admin({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'superadmin',
        status: 'active'
      });

      await defaultAdmin.save();
      console.log('✅ Default admin created!');
      
      // Refresh the list
      const newAdmins = await Admin.find({});
      allAdmins.push(...newAdmins);
    }

    // Display all admins with details
    console.log('\n🔍 Admin Details:');
    console.log('=================');
    
    for (let i = 0; i < allAdmins.length; i++) {
      const admin = allAdmins[i];
      console.log(`\n${i + 1}. Admin Details:`);
      console.log(`   Username: "${admin.username}"`);
      console.log(`   Email: "${admin.email}"`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${admin.status}`);
      console.log(`   Login Attempts: ${admin.loginAttempts}`);
      console.log(`   Locked: ${admin.isLocked ? 'Yes' : 'No'}`);
      console.log(`   Password Hash: ${admin.password.substring(0, 30)}...`);
      
      // Test password comparison
      console.log('\n   🧪 Testing Password Comparisons:');
      
      const testPasswords = ['admin123', 'Admin123', 'ADMIN123', 'admin', 'password'];
      
      for (const testPass of testPasswords) {
        try {
          const isValid = await admin.comparePassword(testPass);
          console.log(`   Password "${testPass}": ${isValid ? '✅ VALID' : '❌ Invalid'}`);
        } catch (error) {
          console.log(`   Password "${testPass}": ❌ Error - ${error.message}`);
        }
      }

      // Test the exact login query that your controller uses
      console.log('\n   🔍 Testing Login Query:');
      const loginTestUsername = 'admin';
      const loginQuery = {
        $or: [
          { username: { $regex: new RegExp(`^${loginTestUsername}$`, 'i') } }, 
          { email: { $regex: new RegExp(`^${loginTestUsername}$`, 'i') } }
        ],
        status: 'active'
      };
      
      console.log('   Query:', JSON.stringify(loginQuery, null, 2));
      
      const foundAdmin = await Admin.findOne(loginQuery);
      console.log(`   Query Result: ${foundAdmin ? '✅ Found' : '❌ Not Found'}`);
      
      if (foundAdmin) {
        console.log(`   Found Admin ID: ${foundAdmin._id}`);
        console.log(`   Found Username: "${foundAdmin.username}"`);
        console.log(`   Found Status: ${foundAdmin.status}`);
        
        // Test password with found admin
        const passwordTest = await foundAdmin.comparePassword('admin123');
        console.log(`   Password Test Result: ${passwordTest ? '✅ VALID' : '❌ Invalid'}`);
      }
    }

    // Manual bcrypt test
    console.log('\n🔧 Manual bcrypt Test:');
    const testPassword = 'admin123';
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(testPassword, salt);
    console.log(`Original: ${testPassword}`);
    console.log(`Hashed: ${hashedPassword}`);
    
    const manualComparison = await bcrypt.compare(testPassword, hashedPassword);
    console.log(`Manual Comparison: ${manualComparison ? '✅ VALID' : '❌ Invalid'}`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
    process.exit(1);
  }
}

async function createFreshAdmin() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    console.log('✅ Connected to MongoDB');

    // Delete existing admin user
    console.log('🗑️ Removing existing admin user...');
    await Admin.deleteOne({ username: 'admin' });
    
    // Create fresh admin
    console.log('👤 Creating fresh admin user...');
    const freshAdmin = new Admin({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      status: 'active',
      loginAttempts: 0
    });

    await freshAdmin.save();
    console.log('✅ Fresh admin created successfully!');
    
    // Verify the new admin
    const verifyAdmin = await Admin.findOne({ username: 'admin' });
    if (verifyAdmin) {
      console.log('\n✅ Verification successful:');
      console.log(`Username: ${verifyAdmin.username}`);
      console.log(`Email: ${verifyAdmin.email}`);
      console.log(`Status: ${verifyAdmin.status}`);
      console.log(`Role: ${verifyAdmin.role}`);
      console.log(`Login Attempts: ${verifyAdmin.loginAttempts}`);
      
      const passwordCheck = await verifyAdmin.comparePassword('admin123');
      console.log(`Password Check: ${passwordCheck ? '✅ VALID' : '❌ Invalid'}`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error creating fresh admin:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'debug':
    debugAdminLogin();
    break;
  case 'fresh':
    createFreshAdmin();
    break;
  default:
    console.log('Available commands:');
    console.log('node debug-admin.js debug  - Debug existing admin login issues');
    console.log('node debug-admin.js fresh  - Create fresh admin user');
    console.log('\nExamples:');
    console.log('node debug-admin.js debug');
    console.log('node debug-admin.js fresh');
}

module.exports = { Admin, debugAdminLogin, createFreshAdmin };