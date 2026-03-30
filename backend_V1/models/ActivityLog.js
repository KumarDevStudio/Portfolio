// models/ActivityLog.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication
      'login', 'logout', 'logout_all', 'refresh_token', 'login_failed',
      // Password & Security
      'password_changed', 'password_reset_requested', 'password_reset_completed',
      // Profile
      'profile_viewed', 'profile_updated',
      // Session Management
      'session_revoked', 'sessions_viewed',
      // Admin Management
      'admin_created', 'admin_updated', 'admin_deleted', 'admin_status_changed',
      'admins_viewed', 'admin_viewed',
      // System
      'tokens_cleaned', 'security_audit_viewed', 'activity_logs_viewed',
      // Other
      'unauthorized_access_attempt', 'suspicious_activity'
    ],
    index: true
  },
  actionDetails: {
    type: String,
    maxlength: 500
  },
  targetAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    index: true
  },
  targetResource: {
    type: String,
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success',
    index: true
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    location: String,
    method: String,
    path: String,
    statusCode: Number,
    responseTime: Number,
    errorCode: String,
    errorMessage: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 7776000 // Auto-delete after 90 days (90 * 24 * 60 * 60)
  }
}, {
  timestamps: false // We're using custom timestamp field
});

// Compound indexes for common queries
activityLogSchema.index({ adminId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ status: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

// Static method to log activity
activityLogSchema.statics.logActivity = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the app
    return null;
  }
};

// Static method to get admin activity summary
activityLogSchema.statics.getAdminSummary = async function(adminId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
adminId: new mongoose.Types.ObjectId(adminId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Static method to get suspicious activities
activityLogSchema.statics.getSuspiciousActivities = async function(hours = 24) {
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return await this.find({
    $or: [
      { status: 'failure' },
      { action: { $in: ['login_failed', 'unauthorized_access_attempt', 'suspicious_activity'] } }
    ],
    timestamp: { $gte: startDate }
  })
  .populate('adminId', 'username email role')
  .sort({ timestamp: -1 })
  .limit(100);
};

// Static method to clean old logs (beyond TTL)
activityLogSchema.statics.cleanOldLogs = async function(daysToKeep = 90) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ timestamp: { $lt: cutoffDate } });
  return result.deletedCount;
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);