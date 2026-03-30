// models/PasswordResetToken.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const passwordResetTokenSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
 
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  usedAt: Date,
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  ipAddress: String,
  userAgent: String,
  requestedBy: {
    type: String,
    enum: ['self', 'superadmin'],
    default: 'self'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours
  }
});

// Generate secure token
passwordResetTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Hash token for storage
passwordResetTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Create password reset token
passwordResetTokenSchema.statics.createResetToken = async function(adminId, ipAddress, userAgent, requestedBy = 'self') {
  await this.updateMany(
    { adminId, isUsed: false },
    { isUsed: true, usedAt: new Date() }
  );

  const token = this.generateToken();
  const tokenHash = this.hashToken(token);
  
  const resetToken = new this({
    adminId,
    tokenHash,          // only the hash — never the plain token
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ipAddress,
    userAgent,
    requestedBy
  });

  await resetToken.save();
  
  // token lives in memory only, never persisted
  return { token, expiresAt: resetToken.expiresAt };
};

// Verify and get token
passwordResetTokenSchema.statics.verifyToken = async function(token) {
  const tokenHash = this.hashToken(token);
  
  const resetToken = await this.findOne({
    tokenHash,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  }).populate('adminId', 'username email status');

  if (!resetToken) {
    return { valid: false, reason: 'invalid_or_expired' };
  }

  if (resetToken.adminId.status !== 'active') {
    return { valid: false, reason: 'admin_inactive' };
  }

  return { valid: true, resetToken };
};

// Mark token as used
passwordResetTokenSchema.methods.markAsUsed = async function() {
  this.isUsed = true;
  this.usedAt = new Date();
  await this.save();
};

// Get recent reset attempts
passwordResetTokenSchema.statics.getRecentAttempts = async function(adminId, hours = 24) {
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.countDocuments({
    adminId,
    createdAt: { $gte: startDate }
  });
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);