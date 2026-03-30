// routes/admin.js
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { logger } = require('../utils/helpers');
const {
  authenticateToken,
  // FIX 6: authRateLimit removed from login — loginRateLimit is stricter and sufficient
  logAdminAction
} = require('../middleware/admin');
const {
  loginRateLimit,
  passwordChangeRateLimit,
  strictRateLimit
} = require('../middleware/security');

// ===========================
// ROUTE VALIDATION MIDDLEWARE
// ===========================
const validateRouteParams = (paramName) => (req, res, next) => {
  const param = req.params[paramName];
  if (!param || param.trim() === '') {
    return res.status(400).json({
      success: false,
      message: `Missing required parameter: ${paramName}`,
      code: 'INVALID_PARAMS'
    });
  }

  if (paramName.toLowerCase().includes('id')) {
    const mongoIdPattern = /^[a-f\d]{24}$/i;
    if (!mongoIdPattern.test(param)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
        code: 'INVALID_ID_FORMAT'
      });
    }
  }

  next();
};

// FIX 9: reject null and empty string, not just undefined
const requireBodyFields = (...fields) => (req, res, next) => {
  const missing = fields.filter(field => {
    const v = req.body?.[field];
    return v === undefined || v === null || v === '';
  });
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}`,
      code: 'MISSING_FIELDS'
    });
  }
  next();
};

// FIX 12: block prototype pollution keys before sanitising
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    const passwordFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword'];
    const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

    Object.keys(req.body).forEach(key => {
      if (BLOCKED.has(key)) { delete req.body[key]; return; }
      if (passwordFields.includes(key)) return;
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
        req.body[key] = req.body[key].replace(/\0/g, '');
      }
    });
  }
  next();
};

// ===========================
// PUBLIC ROUTES (No Auth)
// ===========================
router.post('/login',
  sanitizeInput,
  requireBodyFields('username', 'password'),
  loginRateLimit,        // FIX 6: only loginRateLimit — authRateLimit removed
  logAdminAction('login'),
  AdminController.login
);

router.post('/refresh-token',
  sanitizeInput,
  requireBodyFields('refreshToken'),
  AdminController.refreshToken
);

// ===========================
// PASSWORD RESET ROUTES (Public)
// ===========================
router.post('/forgot-password',
  sanitizeInput,
  requireBodyFields('email'),
  loginRateLimit,
  logAdminAction('password-reset-requested'),
  AdminController.forgotPassword
);

router.get('/verify-reset-token',
  AdminController.verifyResetToken
);

router.post('/reset-password',
  sanitizeInput,
  requireBodyFields('token', 'newPassword'),
  logAdminAction('password-reset-completed'),
  AdminController.resetPassword
);

// ===========================
// AUTHENTICATED ROUTES
// ===========================
router.post('/logout',
  authenticateToken,
  sanitizeInput,
  logAdminAction('logout'),
  AdminController.logout
);

router.post('/logout-all',
  authenticateToken,
  strictRateLimit,
  logAdminAction('logout-all'),
  AdminController.logoutAll
);

// ===========================
// PROFILE MANAGEMENT
// ===========================
router.get('/profile',
  authenticateToken,
  AdminController.getProfile
);

router.put('/profile',
  authenticateToken,
  sanitizeInput,
  strictRateLimit,
  logAdminAction('update-profile'),
  AdminController.updateProfile
);

router.post('/change-password',
  authenticateToken,
  sanitizeInput,
  requireBodyFields('currentPassword', 'newPassword'),
  passwordChangeRateLimit,
  logAdminAction('change-password'),
  AdminController.changePassword
);

// ===========================
// SESSION MANAGEMENT
// ===========================
router.get('/sessions',
  authenticateToken,
  AdminController.getActiveSessions
);

router.delete('/sessions/:sessionId',
  authenticateToken,
  validateRouteParams('sessionId'),
  strictRateLimit,
  logAdminAction('revoke-session'),
  AdminController.revokeSession
);

// ===========================
// SYSTEM MAINTENANCE
// ===========================
router.post('/cleanup-tokens',
  authenticateToken,
  strictRateLimit,
  logAdminAction('cleanup-tokens'),
  AdminController.cleanupExpiredTokens
);

router.get('/security-audit',
  authenticateToken,
  AdminController.getSecurityAudit
);

router.get('/system/health',
  authenticateToken,
  async (req, res) => {
    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date(),
      uptime: process.uptime()
    });
  }
);

// ===========================
// ACTIVITY LOGS (Own Activity Only)
// ===========================
router.get('/activity-logs',
  authenticateToken,
  AdminController.getActivityLogs
);

router.get('/activity-logs/statistics',
  authenticateToken,
  AdminController.getActivityStatistics
);

router.get('/activity-logs/suspicious',
  authenticateToken,
  AdminController.getSuspiciousActivities
);

router.get('/activity-logs/export',
  authenticateToken,
  strictRateLimit,
  AdminController.exportActivityLogs
);

router.post('/activity-logs/cleanup',
  authenticateToken,
  strictRateLimit,
  logAdminAction('clean-activity-logs'),
  AdminController.cleanOldActivityLogs
);

router.get('/activity-summary',
  authenticateToken,
  AdminController.getActivitySummary
);

// ===========================
// 404 HANDLER FOR ADMIN ROUTES
// ===========================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Admin route not found: ${req.method} ${req.path}`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// ===========================
// ERROR HANDLING
// ===========================
router.use((error, req, res, next) => {
  logger.error('Admin route error', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    adminId: req.admin?.adminId,
    ip: req.ip
  });

  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.status(error.status || 500).json({
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    code: error.code || 'ADMIN_ROUTE_ERROR',
    ...(isDevelopment && { stack: error.stack })
  });
});

module.exports = router;