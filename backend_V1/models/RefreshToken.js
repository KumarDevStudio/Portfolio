const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true
    // Removed: unique: true - defined in schema.index() instead
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + (parseInt(process.env.REFRESH_EXPIRY_DAYS || '7') * 24 * 60 * 60 * 1000))
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date
  },
revokedReason: {
    type: String,
    enum: [
      'logout',
      'logout_all',
      'password_change',
      'password_reset',
      'token_rotation',
      'manual_revocation',
      'admin_action',
      'suspicious_activity',
      'other'
    ]
  },
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    deviceType: String
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
refreshTokenSchema.index({ token: 1 }, { unique: true });
refreshTokenSchema.index({ adminId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ isRevoked: 1, expiresAt: 1 });

// Pre-save hook to ensure expiresAt and handle revocation
refreshTokenSchema.pre('save', function(next) {
  if (this.isModified('isRevoked') && this.isRevoked && !this.revokedAt) {
    this.revokedAt = new Date();
  }
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + (parseInt(process.env.REFRESH_EXPIRY_DAYS || '7') * 24 * 60 * 60 * 1000));
  }
  next();
});

// Method to check if token is valid
refreshTokenSchema.methods.isValid = function() {
  return !this.isRevoked && this.expiresAt > Date.now();
};

// Static method to cleanup invalid tokens (expired or revoked)
refreshTokenSchema.statics.cleanupInvalid = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lte: Date.now() } },
      { isRevoked: true }
    ]
  });
  return result.deletedCount;
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);