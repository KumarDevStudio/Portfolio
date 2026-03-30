const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Admin Schema (make sure this matches your model)
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

// Seeder function
async function seedAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    console.log('Connected to MongoDB');

    // Check if any admins exist
    const existingAdmins = await Admin.countDocuments();
    console.log(`Existing admins in database: ${existingAdmins}`);

    // If no admins exist, create a default super admin
    if (existingAdmins === 0) {
      const defaultAdmin = new Admin({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123', // This will be hashed automatically
        firstName: 'Super',
        lastName: 'Admin',
        role: 'superadmin',
        status: 'active'
      });

      await defaultAdmin.save();
      console.log('✅ Default super admin created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
      console.log('Email: admin@example.com');
    } else {
      console.log('Admin accounts already exist. Listing current admins:');
      
      const admins = await Admin.find({}).select('username email role status createdAt');
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Username: ${admin.username}, Email: ${admin.email}, Role: ${admin.role}, Status: ${admin.status}`);
      });
    }

    // Test password hashing with the default admin
    const testAdmin = await Admin.findOne({ username: 'admin' });
    if (testAdmin) {
      console.log('\n🧪 Testing password comparison:');
      const isValidPassword = await testAdmin.comparePassword('admin123');
      console.log(`Password 'admin123' is valid: ${isValidPassword}`);
      
      // Show password hash for debugging
      console.log(`Stored password hash: ${testAdmin.password.substring(0, 20)}...`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
}

// Add option to reset password for existing admin
async function resetAdminPassword(username, newPassword) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    
    const admin = await Admin.findOne({ username });
    if (!admin) {
      console.log(`❌ Admin with username '${username}' not found`);
      return;
    }

    admin.password = newPassword; // This will trigger the pre-save hook to hash it
    admin.loginAttempts = 0; // Reset login attempts
    admin.lockUntil = undefined; // Unlock account
    
    await admin.save();
    
    console.log(`✅ Password reset successful for admin: ${username}`);
    console.log(`New password: ${newPassword}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  }
}

// Add option to list all admins
async function listAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    
    const admins = await Admin.find({}).select('username email role status loginAttempts lockUntil createdAt');
    
    console.log('\n📋 Current Admin Accounts:');
    console.log('================================');
    
    if (admins.length === 0) {
      console.log('No admin accounts found.');
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Username: ${admin.username}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Status: ${admin.status}`);
        console.log(`   Login Attempts: ${admin.loginAttempts}`);
        console.log(`   Locked: ${admin.isLocked ? 'Yes' : 'No'}`);
        console.log(`   Created: ${admin.createdAt}`);
        console.log('   ---------------');
      });
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error listing admins:', error);
  }
}

// Command line interface
const command = process.argv[2];
const username = process.argv[3];
const password = process.argv[4];

switch (command) {
  case 'seed':
    seedAdmin();
    break;
  case 'reset':
    if (!username || !password) {
      console.log('Usage: node seed-admin.js reset <username> <newPassword>');
      console.log('Example: node seed-admin.js reset admin newpassword123');
    } else {
      resetAdminPassword(username, password);
    }
    break;
  case 'list':
    listAdmins();
    break;
  default:
    console.log('Available commands:');
    console.log('node seed-admin.js seed          - Create default admin if none exist');
    console.log('node seed-admin.js list          - List all admin accounts');
    console.log('node seed-admin.js reset <user> <pass> - Reset admin password');
    console.log('\nExamples:');
    console.log('node seed-admin.js seed');
    console.log('node seed-admin.js list');
    console.log('node seed-admin.js reset admin newpassword123');
}

module.exports = { Admin, seedAdmin, resetAdminPassword, listAdmins };