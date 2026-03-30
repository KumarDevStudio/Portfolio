const Admin = require('../models/Admin');
const RefreshToken = require('../models/RefreshToken');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { loginValidation } = require('../config/validation');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../utils/email');
const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');

const {
  logger,
  errorResponse,
  successResponse,
  validatePassword,
  getDeviceInfo,
  checkSuspiciousLogin
} = require('../utils/helpers');

// FIX 4: import cache invalidation so we can call it after mutations
const { clearAdminCache } = require('../middleware/admin');

// FIX 2: hash refresh tokens before storing — never store plaintext
const hashToken = (t) =>
  crypto.createHash('sha256').update(t).digest('hex');

// FIX 3: escape regex special characters before using in RegExp
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Helper: cast JWT adminId string → ObjectId for all DB queries ──────────
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

class AdminController {
  constructor() {
    this.login = this.login.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.logout = this.logout.bind(this);
    this.logoutAll = this.logoutAll.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.getActiveSessions = this.getActiveSessions.bind(this);
    this.revokeSession = this.revokeSession.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.cleanupExpiredTokens = this.cleanupExpiredTokens.bind(this);
    this.getSecurityAudit = this.getSecurityAudit.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.verifyResetToken = this.verifyResetToken.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.getActivityLogs = this.getActivityLogs.bind(this);
    this.getActivitySummary = this.getActivitySummary.bind(this);
    this.getSuspiciousActivities = this.getSuspiciousActivities.bind(this);
    this.getActivityStatistics = this.getActivityStatistics.bind(this);
    this.exportActivityLogs = this.exportActivityLogs.bind(this);
    this.cleanOldActivityLogs = this.cleanOldActivityLogs.bind(this);
  }

  // ─── Helper: generate access + refresh token pair ───────────────────────
  async _generateTokens(admin, req) {
    const accessToken = jwt.sign(
      {
        adminId: admin._id,
        role: admin.role,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: '55m' }
    );

    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const deviceInfo = getDeviceInfo(req);

    // FIX 2: store hash of refresh token, return raw value to client
    const refreshToken = new RefreshToken({
      token: hashToken(refreshTokenValue),
      adminId: admin._id,
      deviceInfo,
      lastUsed: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await refreshToken.save();

    return { accessToken, refreshToken: refreshTokenValue };
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async login(req, res, next) {
    try {
      const { error } = loginValidation.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'Validation error', 'VALIDATION_ERROR', {
          errors: error.details.map(d => d.message)
        });
      }

      const { username, password } = req.body;

      // FIX 3: escape username before building regex to prevent injection
      const admin = await Admin.findOne({
        $or: [
          { username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } },
          { email:    { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } }
        ],
        status: 'active'
      });

      if (!admin) {
        logger.warn(`Login attempt for non-existent admin: ${username} from IP: ${req.ip}`);
        return errorResponse(res, 401, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      if (admin.isLocked) {
        logger.warn(`Login attempt for locked admin: ${admin.username} from IP: ${req.ip}`);
        return errorResponse(res, 423, 'Account is temporarily locked due to too many failed attempts', 'ACCOUNT_LOCKED', {
          lockUntil: admin.lockUntil
        });
      }

      const isValidPassword = await admin.comparePassword(password);
      if (!isValidPassword) {
        admin.loginAttempts += 1;

        if (admin.loginAttempts >= 5) {
          const lockDuration = Math.min(15 * Math.pow(2, Math.floor(admin.loginAttempts / 5)), 60);
          admin.lockUntil = new Date(Date.now() + lockDuration * 60 * 1000);
          logger.warn(`Admin account locked: ${admin.username} from IP: ${req.ip} - ${admin.loginAttempts} failed attempts`);
          admin.loginAttempts = 0;
        } else {
          logger.warn(`Failed login attempt ${admin.loginAttempts}/5 for admin: ${admin.username} from IP: ${req.ip}`);
        }

        await admin.save();

        const isNowLocked = !!(admin.lockUntil && admin.lockUntil > Date.now());
        return errorResponse(res, 401, 'Invalid credentials', 'INVALID_CREDENTIALS', {
          remainingAttempts: isNowLocked ? 0 : Math.max(0, 5 - admin.loginAttempts)
        });
      }

      if (admin.loginAttempts > 0 || admin.lockUntil) {
        admin.loginAttempts = 0;
        admin.lockUntil = undefined;
      }
      admin.lastLogin = new Date();
      await admin.save();

      // Cleanup old refresh tokens (older than 30 days)
      await RefreshToken.deleteMany({
        adminId: admin._id,
        createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      await checkSuspiciousLogin(admin, req);

      const tokens = await this._generateTokens(admin, req);
      const currentDevice = getDeviceInfo(req);

      logger.info(`Successful admin login: ${admin.username} from IP: ${req.ip}, Device: ${currentDevice.deviceType}`);

      return successResponse(res, 'Login successful', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        admin: {
          id: admin._id,
          username: admin.username,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          lastLogin: admin.lastLogin
        }
      });
    } catch (error) {
      logger.error('Login error', { message: error.message, stack: error.stack, ip: req.ip, username: req.body.username });
      next(error);
    }
  }

  // ─── Forgot password ─────────────────────────────────────────────────────
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return errorResponse(res, 400, 'Email is required', 'EMAIL_REQUIRED');
      }

      const admin = await Admin.findOne({
        email: email.toLowerCase().trim(),
        status: 'active'
      });

      // Always return success to prevent email enumeration
      const successMessage = 'If an account exists with this email, a password reset link has been sent.';

      if (!admin) {
        logger.warn(`Password reset requested for non-existent email: ${email} from IP: ${req.ip}`);
        return successResponse(res, successMessage);
      }

      const recentAttempts = await PasswordResetToken.getRecentAttempts(admin._id, 1);
      if (recentAttempts >= 3) {
        logger.warn(`Password reset rate limit exceeded for admin: ${admin.username} from IP: ${req.ip}`);
        return successResponse(res, successMessage);
      }

      const deviceInfo = getDeviceInfo(req);
      const { token, expiresAt } = await PasswordResetToken.createResetToken(
        admin._id,
        deviceInfo.ipAddress,
        deviceInfo.userAgent,
        'self'
      );

      const resetLink = `${process.env.FRONTEND_URL}/admin/reset-password?token=${token}`;

      try {
        await sendPasswordResetEmail(admin.email, admin.firstName || admin.username, resetLink, expiresAt);
        logger.info(`Password reset email sent to: ${admin.email} from IP: ${req.ip}`);
      } catch (emailError) {
        logger.error('Failed to send password reset email:', emailError);
      }

      return successResponse(res, successMessage);
    } catch (error) {
      logger.error('Forgot password error', { message: error.message, stack: error.stack, ip: req.ip, email: req.body.email });
      next(error);
    }
  }

  // ─── Verify reset token ──────────────────────────────────────────────────
  async verifyResetToken(req, res, next) {
    try {
      const { token } = req.query;

      if (!token) {
        return errorResponse(res, 400, 'Reset token is required', 'TOKEN_REQUIRED');
      }

      const verification = await PasswordResetToken.verifyToken(token);

      if (!verification.valid) {
        const messages = {
          'invalid_or_expired': 'Invalid or expired reset token',
          'admin_inactive': 'Account is inactive'
        };
        return errorResponse(res, 400, messages[verification.reason] || 'Invalid token', 'INVALID_TOKEN');
      }

      return successResponse(res, 'Token is valid', {
        email: verification.resetToken.adminId.email,
        username: verification.resetToken.adminId.username
      });
    } catch (error) {
      logger.error('Verify reset token error:', error);
      next(error);
    }
  }

  // ─── Reset password ──────────────────────────────────────────────────────
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return errorResponse(res, 400, 'Token and new password are required', 'MISSING_FIELDS');
      }

      if (!validatePassword(newPassword)) {
        return errorResponse(res, 400, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character', 'WEAK_PASSWORD');
      }

      const verification = await PasswordResetToken.verifyToken(token);

      if (!verification.valid) {
        logger.warn(`Invalid password reset attempt with token from IP: ${req.ip}`);
        return errorResponse(res, 400, 'Invalid or expired reset token', 'INVALID_TOKEN');
      }

      const { resetToken } = verification;
      const admin = resetToken.adminId;

      admin.password = newPassword;
      admin.passwordChangedAt = new Date();
      admin.loginAttempts = 0;
      admin.lockUntil = undefined;
      await admin.save();

      // FIX 4: invalidate cache after password change
      clearAdminCache(admin._id.toString());

      await resetToken.markAsUsed();

      await RefreshToken.updateMany(
        { adminId: admin._id },
        {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'password_reset'
        }
      );

      logger.info(`Password reset completed for admin: ${admin.username} from IP: ${req.ip}`);

      return successResponse(res, 'Password has been reset successfully. Please login with your new password.');
    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }

  // ─── Refresh token ───────────────────────────────────────────────────────
  async refreshToken(req, res, next) {
    try {
      const { refreshToken: oldRefreshToken } = req.body;
      if (!oldRefreshToken) {
        return errorResponse(res, 400, 'Refresh token required', 'MISSING_REFRESH_TOKEN');
      }

      // FIX 2: look up by hash, not plaintext
      const tokenDoc = await RefreshToken.findOne({
        token: hashToken(oldRefreshToken),
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).populate('adminId');

      if (!tokenDoc || !tokenDoc.adminId || tokenDoc.adminId.status !== 'active') {
        return errorResponse(res, 401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
      }

      const newTokens = await this._generateTokens(tokenDoc.adminId, req);

      tokenDoc.lastUsed = new Date();
      tokenDoc.isRevoked = true;
      tokenDoc.revokedAt = new Date();
      tokenDoc.revokedReason = 'token_rotation';
      await tokenDoc.save();

      logger.info(`Token refreshed for admin: ${tokenDoc.adminId.username}`);

      return successResponse(res, 'Token refreshed successfully', newTokens);
    } catch (error) {
      logger.error('Refresh token error', { message: error.message, stack: error.stack, ip: req.ip });
      next(error);
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // FIX 2: look up stored hash when revoking on logout
        const result = await RefreshToken.findOneAndUpdate(
          { token: hashToken(refreshToken) },
          {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'logout'
          }
        );

        if (result) {
          logger.info(`Admin logout: ${result.adminId} revoked refresh token from IP: ${req.ip}`);
        }
      }

      return successResponse(res, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  // ─── Logout all devices ──────────────────────────────────────────────────
  async logoutAll(req, res, next) {
    try {
      const result = await RefreshToken.updateMany(
        {
          adminId: req.admin.adminId,
          isRevoked: false
        },
        {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'logout_all'
        }
      );

      logger.info(`Admin ${req.admin.adminId} logged out from ${result.modifiedCount} devices`);

      return successResponse(res, `Logged out from all devices successfully (${result.modifiedCount} sessions)`);
    } catch (error) {
      logger.error('Logout all error:', error);
      next(error);
    }
  }

  // ─── Change password ─────────────────────────────────────────────────────
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return errorResponse(res, 400, 'Current password and new password are required', 'MISSING_PASSWORDS');
      }

      if (!validatePassword(newPassword)) {
        return errorResponse(res, 400, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character', 'WEAK_PASSWORD');
      }

      const admin = await Admin.findById(req.admin.adminId);
      if (!admin) {
        return errorResponse(res, 404, 'Admin not found', 'ADMIN_NOT_FOUND');
      }

      const isValidPassword = await admin.comparePassword(currentPassword);
      if (!isValidPassword) {
        logger.warn(`Invalid current password attempt for admin: ${admin.username} from IP: ${req.ip}`);
        return errorResponse(res, 400, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
      }

      admin.password = newPassword;
      admin.passwordChangedAt = new Date();
      await admin.save();

      // FIX 4: invalidate cache so stale passwordChangedAt is not served
      clearAdminCache(admin._id.toString());

      await RefreshToken.updateMany(
        { adminId: admin._id },
        {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'password_change'
        }
      );

      logger.info(`Password changed for admin: ${admin.username} from IP: ${req.ip}`);

      return successResponse(res, 'Password changed successfully. Please login again with your new password.');
    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }

  // ─── Get active sessions ─────────────────────────────────────────────────
  async getActiveSessions(req, res, next) {
    try {
      const sessions = await RefreshToken.find({
        adminId: req.admin.adminId,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).select('deviceInfo lastUsed createdAt expiresAt token').sort({ lastUsed: -1 });

      const currentRefreshToken =
        req.headers['x-refresh-token'] ||
        req.body?.refreshToken ||
        req.query?.refreshToken;

      // FIX 2: compare hashes, not plaintext tokens
      const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

      const enrichedSessions = sessions.map(session => ({
        id: session._id,
        deviceType: session.deviceInfo?.deviceType || 'unknown',
        ipAddress: session.deviceInfo?.ipAddress || 'unknown',
        location: session.deviceInfo?.location || null,
        userAgent: session.deviceInfo?.userAgent?.substring(0, 100) || 'unknown',
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        expiresAt: session.expiresAt,
        isCurrentSession: currentTokenHash ? session.token === currentTokenHash : false
      }));

      return successResponse(res, 'Active sessions retrieved successfully', {
        totalSessions: enrichedSessions.length,
        sessions: enrichedSessions
      });
    } catch (error) {
      logger.error('Get active sessions error:', error);
      next(error);
    }
  }

  // ─── Revoke session ──────────────────────────────────────────────────────
  async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;

      const result = await RefreshToken.findOneAndUpdate(
        {
          _id: sessionId,
          adminId: req.admin.adminId,
          isRevoked: false
        },
        {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'manual_revocation'
        }
      );

      if (!result) {
        return errorResponse(res, 404, 'Session not found or already revoked', 'SESSION_NOT_FOUND');
      }

      logger.info(`Session revoked: ${sessionId} for admin: ${req.admin.adminId}`);

      return successResponse(res, 'Session revoked successfully');
    } catch (error) {
      logger.error('Revoke session error:', error);
      next(error);
    }
  }

  // ─── Get profile ─────────────────────────────────────────────────────────
  async getProfile(req, res, next) {
    try {
      const admin = await Admin.findById(req.admin.adminId)
        .select('-password -loginAttempts -lockUntil')
        .lean();

      if (!admin) {
        return errorResponse(res, 404, 'Admin not found', 'ADMIN_NOT_FOUND');
      }

      return successResponse(res, 'Profile retrieved successfully', admin);
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  // ─── Update profile ──────────────────────────────────────────────────────
  async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, email } = req.body;

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return errorResponse(res, 400, 'Invalid email format', 'INVALID_EMAIL');
        }
      }

      const updateData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;

      const admin = await Admin.findByIdAndUpdate(
        req.admin.adminId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password -loginAttempts -lockUntil');

      if (!admin) {
        return errorResponse(res, 404, 'Admin not found', 'ADMIN_NOT_FOUND');
      }

      // FIX 4: invalidate cache so updated email/name is served immediately
      clearAdminCache(admin._id.toString());

      logger.info(`Profile updated for admin: ${admin.username}`);

      return successResponse(res, 'Profile updated successfully', admin);
    } catch (error) {
      if (error.code === 11000) {
        return errorResponse(res, 400, 'Email already exists', 'DUPLICATE_EMAIL');
      }
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  // ─── Cleanup expired tokens ──────────────────────────────────────────────
  async cleanupExpiredTokens(req, res, next) {
    try {
      // FIX 8: single atomic query — no race condition between two parallel deletes
      const result = await RefreshToken.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          {
            isRevoked: true,
            revokedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        ]
      });

      const totalCleaned = result.deletedCount;

      logger.info(`Token cleanup completed: ${totalCleaned} tokens removed`);

      return successResponse(res, `Cleaned up ${totalCleaned} tokens`, {
        total: totalCleaned
      });
    } catch (error) {
      logger.error('Cleanup tokens error:', error);
      next(error);
    }
  }

  // ─── Security audit ──────────────────────────────────────────────────────
  async getSecurityAudit(req, res, next) {
    try {
      const adminObjId = toObjectId(req.admin.adminId);

      const [
        activeSessions,
        recentLogins,
        failedAttemptsLast24h,
        topLoginIPs,
        passwordLastChanged
      ] = await Promise.all([
        RefreshToken.countDocuments({
          adminId: adminObjId,
          isRevoked: false,
          expiresAt: { $gt: new Date() }
        }),
        Admin.findById(adminObjId).select('lastLogin').lean(),
        Admin.findById(adminObjId).select('loginAttempts').lean(),
        RefreshToken.aggregate([
          {
            $match: {
              adminId: adminObjId,
              createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          },
          { $group: { _id: '$deviceInfo.ipAddress', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]),
        Admin.findById(adminObjId).select('passwordChangedAt').lean()
      ]);

      return successResponse(res, 'Security audit retrieved successfully', {
        sessionStats: { activeSessions },
        loginStats: {
          lastLogin: recentLogins?.lastLogin,
          failedAttempts: failedAttemptsLast24h?.loginAttempts || 0,
          topLoginIPs
        },
        passwordStats: {
          lastChanged: passwordLastChanged?.passwordChangedAt,
          daysSinceChange: passwordLastChanged?.passwordChangedAt
            ? Math.floor((Date.now() - new Date(passwordLastChanged.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24))
            : null
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Security audit error:', error);
      next(error);
    }
  }

  // ─── Get activity logs ───────────────────────────────────────────────────
  async getActivityLogs(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        status,
        startDate,
        endDate,
        ipAddress,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 50));

      const query = { adminId: toObjectId(req.admin.adminId) };

      if (action) {
        const actions = action.split(',').map(a => a.trim());
        query.action = { $in: actions };
      }

      if (status) {
        query.status = status;
      }

      if (ipAddress) {
        query['metadata.ipAddress'] = ipAddress;
      }

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const [logs, total] = await Promise.all([
        ActivityLog.find(query)
          .populate('adminId', 'username email role')
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .sort(sortOptions)
          .lean(),
        ActivityLog.countDocuments(query)
      ]);

      return successResponse(res, 'Activity logs retrieved successfully', {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        filters: { action, status, startDate, endDate, ipAddress }
      });
    } catch (error) {
      logger.error('Get activity logs error:', error);
      next(error);
    }
  }

  // ─── Get activity summary ────────────────────────────────────────────────
  async getActivitySummary(req, res, next) {
    try {
      const { days = 30 } = req.query;
      const daysNum = Math.max(1, Math.min(365, parseInt(days) || 30));
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const adminObjId = toObjectId(req.admin.adminId);

      const summary = await ActivityLog.getAdminSummary(req.admin.adminId, daysNum);

      const recentActivities = await ActivityLog.find({
        adminId: adminObjId,
        timestamp: { $gte: startDate }
      })
        .select('action actionDetails status timestamp metadata.ipAddress')
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      const loginStats = await ActivityLog.aggregate([
        {
          $match: {
            adminId: adminObjId,
            action: { $in: ['login', 'login_failed'] },
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: { _id: '$action', count: { $sum: 1 } }
        }
      ]);

      const uniqueIPs = await ActivityLog.distinct('metadata.ipAddress', {
        adminId: adminObjId,
        timestamp: { $gte: startDate }
      });

      return successResponse(res, 'Activity summary retrieved successfully', {
        period: { days: daysNum, startDate, endDate: new Date() },
        summary,
        recentActivities,
        loginStats: {
          successful: loginStats.find(s => s._id === 'login')?.count || 0,
          failed: loginStats.find(s => s._id === 'login_failed')?.count || 0
        },
        uniqueIPsUsed: uniqueIPs.length,
        uniqueIPs
      });
    } catch (error) {
      logger.error('Get activity summary error:', error);
      next(error);
    }
  }

  // ─── Get suspicious activities ───────────────────────────────────────────
  async getSuspiciousActivities(req, res, next) {
    try {
      const { hours = 24 } = req.query;
      const hoursNum = Math.max(1, Math.min(168, parseInt(hours) || 24));
      const since = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

      const adminObjId = toObjectId(req.admin.adminId);

      const suspiciousActivities = await ActivityLog.find({
        adminId: adminObjId,
        status: 'failure',
        timestamp: { $gte: since }
      })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      const failuresByIP = await ActivityLog.aggregate([
        {
          $match: {
            adminId: adminObjId,
            status: 'failure',
            timestamp: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$metadata.ipAddress',
            count: { $sum: 1 },
            actions: { $addToSet: '$action' },
            lastActivity: { $max: '$timestamp' }
          }
        },
        { $match: { count: { $gte: 3 } } },
        { $sort: { count: -1 } }
      ]);

      return successResponse(res, 'Suspicious activities retrieved successfully', {
        period: { hours: hoursNum, startDate: since, endDate: new Date() },
        totalActivities: suspiciousActivities.length,
        activities: suspiciousActivities,
        suspiciousIPs: failuresByIP
      });
    } catch (error) {
      logger.error('Get suspicious activities error:', error);
      next(error);
    }
  }

  // ─── Get activity statistics ─────────────────────────────────────────────
  async getActivityStatistics(req, res, next) {
    try {
      const { days = 7 } = req.query;
      const daysNum = Math.max(1, Math.min(90, parseInt(days) || 7));
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const adminObjId = toObjectId(req.admin.adminId);

      const activityByDay = await ActivityLog.aggregate([
        { $match: { adminId: adminObjId, timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year:  { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day:   { $dayOfMonth: '$timestamp' }
            },
            total:      { $sum: 1 },
            successful: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failed:     { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      const mostCommonActions = await ActivityLog.aggregate([
        { $match: { adminId: adminObjId, timestamp: { $gte: startDate } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 }
      ]);

      const activityByHour = await ActivityLog.aggregate([
        { $match: { adminId: adminObjId, timestamp: { $gte: startDate } } },
        { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } },
        { $sort: { '_id': 1 } }
      ]);

      return successResponse(res, 'Activity statistics retrieved successfully', {
        period: { days: daysNum, startDate, endDate: new Date() },
        activityByDay,
        mostCommonActions,
        activityByHour
      });
    } catch (error) {
      logger.error('Get activity statistics error:', error);
      next(error);
    }
  }

  // ─── Export activity logs ────────────────────────────────────────────────
  async exportActivityLogs(req, res, next) {
    try {
      const { format = 'json', startDate, endDate } = req.query;

      const query = { adminId: toObjectId(req.admin.adminId) };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const logs = await ActivityLog.find(query)
        .populate('adminId', 'username email role')
        .limit(10000)
        .sort({ timestamp: -1 })
        .lean();

      if (format === 'csv') {
        const fields = ['timestamp', 'action', 'actionDetails', 'status', 'ipAddress', 'deviceType', 'statusCode'];

        const csv = logs.map(log =>
          [
            log.timestamp,
            log.action,
            log.actionDetails || '',
            log.status,
            log.metadata?.ipAddress || '',
            log.metadata?.deviceType || '',
            log.metadata?.statusCode || ''
          ].map(field => `"${field}"`).join(',')
        );

        const csvContent = [fields.join(','), ...csv].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
        return res.send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.json`);
      return res.json({
        success: true,
        exportDate: new Date(),
        totalRecords: logs.length,
        filters: { startDate, endDate },
        logs
      });
    } catch (error) {
      logger.error('Export activity logs error:', error);
      next(error);
    }
  }

  // ─── Clean old activity logs ─────────────────────────────────────────────
  async cleanOldActivityLogs(req, res, next) {
    try {
      const { daysToKeep = 90 } = req.body;
      const days = Math.max(30, Math.min(365, parseInt(daysToKeep) || 90));

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await ActivityLog.deleteMany({
        adminId: toObjectId(req.admin.adminId),
        timestamp: { $lt: cutoffDate }
      });

      logger.info(`Cleaned ${result.deletedCount} old activity logs (older than ${days} days) for admin: ${req.admin.adminId}`);

      return successResponse(res, `Cleaned ${result.deletedCount} old activity logs`, {
        deletedCount: result.deletedCount,
        daysKept: days
      });
    } catch (error) {
      logger.error('Clean old activity logs error:', error);
      next(error);
    }
  }
}

module.exports = new AdminController();