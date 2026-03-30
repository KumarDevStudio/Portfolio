const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { logger } = require('../utils/helpers');

// Cache for frequently accessed admin data (use Redis in production)
const adminCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Standard error response helper
const errorResponse = (res, statusCode, message, code, additionalData = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...additionalData
  });
};

// Helper function to get admin from cache or database
const getAdminById = async (adminId) => {
  const cacheKey = `admin:${adminId}`;
  const cached = adminCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.admin;
  }

  const admin = await Admin.findById(adminId).select('-password');
  if (admin) {
    adminCache.set(cacheKey, {
      admin,
      timestamp: Date.now()
    });
  }

  return admin;
};

// Clear admin from cache (call when admin data changes)
const clearAdminCache = (adminId) => {
  adminCache.delete(`admin:${adminId}`);
};

// Cleanup expired cache entries
const cleanupCache = () => {
  const cutoff = Date.now() - CACHE_DURATION;
  let cleaned = 0;

  for (const [key, value] of adminCache.entries()) {
    if (value.timestamp < cutoff) {
      adminCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0 && process.env.NODE_ENV !== 'test') {
    logger.info(`Cleaned up ${cleaned} cached admin entries`);
  }
};

// Run cleanup every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

// Rate limiting for authentication attempts (use Redis in production)
const authRateLimit = (() => {
  const attempts = new Map();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 20;

  // FIX 11 (perf): dedicated interval instead of probabilistic cleanup
  setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, times] of attempts.entries()) {
      if (!times.some(t => t > cutoff)) attempts.delete(key);
    }
  }, WINDOW_MS);

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    const ipAttempts = attempts.get(ip) || [];
    const recentAttempts = ipAttempts.filter(time => now - time < WINDOW_MS);

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      logger.warn(`Authentication rate limit exceeded for IP: ${ip}`);
      return errorResponse(res, 429, 'Too many authentication attempts. Please try again later.', 'RATE_LIMIT_EXCEEDED');
    }

    recentAttempts.push(now);
    attempts.set(ip, recentAttempts);

    next();
  };
})();

// Core authentication middleware with enhanced security
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Access token required. Use Bearer token format.', 'TOKEN_MISSING');
    }

    const token = authHeader.substring(7);

    if (!token) {
      return errorResponse(res, 401, 'Access token required', 'TOKEN_MISSING');
    }

    // Verify and decode token — jwt.verify() enforces expiry via expiresIn:'55m'
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate token payload
    if (!decoded.adminId || !decoded.role || !decoded.iat) {
      return errorResponse(res, 401, 'Invalid token payload', 'INVALID_TOKEN_PAYLOAD');
    }

    // FIX 11: removed dead MAX_TOKEN_AGE check — jwt.verify already rejects expired tokens

    // Get admin from cache or database
    const admin = await getAdminById(decoded.adminId);

    if (!admin) {
      return errorResponse(res, 401, 'Admin not found', 'ADMIN_NOT_FOUND');
    }

    if (admin.status !== 'active') {
      return errorResponse(res, 401, 'Admin account is inactive', 'ACCOUNT_INACTIVE');
    }

    // Check if account is locked
    if (admin.isLocked || (admin.lockUntil && admin.lockUntil > new Date())) {
      return errorResponse(res, 423, 'Account is temporarily locked', 'ACCOUNT_LOCKED', {
        lockUntil: admin.lockUntil
      });
    }

    // Check if token was issued before password change (FIX 5: field now exists in schema)
    if (admin.passwordChangedAt && decoded.iat < Math.floor(admin.passwordChangedAt.getTime() / 1000)) {
      return errorResponse(res, 401, 'Token invalid due to password change. Please login again.', 'TOKEN_EXPIRED_PASSWORD_CHANGE');
    }

    if (process.env.NODE_ENV !== 'test') {
      logger.info(`Auth success: ${admin.username} (${admin.role}) from IP: ${req.ip}`);
    }

    // FIX 1: role always read from DB, never from the JWT payload
    req.admin = {
      adminId: decoded.adminId,
      username: admin.username,
      role: admin.role,      // ← from DB, not decoded.role
      email: admin.email
    };
    // FIX 13: req.adminDoc removed — controllers fetch the full doc when they need it

    next();
  } catch (error) {
    let errorMsg = 'Authentication error';
    let errorCode = 'AUTH_ERROR';
    let additionalData = {};

    if (error.name === 'TokenExpiredError') {
      errorMsg = 'Access token expired';
      errorCode = 'TOKEN_EXPIRED';
      additionalData.expiredAt = error.expiredAt;
    } else if (error.name === 'JsonWebTokenError') {
      errorMsg = 'Invalid access token';
      errorCode = 'INVALID_TOKEN';
    } else if (error.name === 'NotBeforeError') {
      errorMsg = 'Token not active yet';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }

    logger.warn(`Auth error: ${error.message} - IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);

    return errorResponse(res, 401, errorMsg, errorCode, additionalData);
  }
};

// Optional authentication (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await getAdminById(decoded.adminId);

    if (admin && admin.status === 'active' && !admin.isLocked) {
      // FIX 1 + FIX 13: role from DB, no req.adminDoc
      req.admin = {
        adminId: decoded.adminId,
        username: admin.username,
        role: admin.role,
        email: admin.email
      };
    }

    next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      logger.debug(`Optional auth failed (continuing): ${error.message} - IP: ${req.ip}`);
    }
    next();
  }
};

// Role-based authorization middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return errorResponse(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    if (!roles.includes(req.admin.role)) {
      logger.warn(`Authorization failed: User ${req.admin.adminId} (${req.admin.role}) attempted to access ${req.method} ${req.path} - Required roles: ${roles.join(', ')}`);

      return errorResponse(res, 403, `Access denied. Required role(s): ${roles.join(', ')}`, 'INSUFFICIENT_PERMISSIONS', {
        userRole: req.admin.role,
        requiredRoles: roles
      });
    }

    next();
  };
};

const requireSuperAdmin = requireRole('superadmin');
const requireAdmin = requireRole('admin', 'superadmin');

const adminAuth = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
};

const superAdminAuth = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    requireSuperAdmin(req, res, next);
  });
};

const requireSelfOrSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return errorResponse(res, 401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const targetAdminId = req.params.adminId || req.params.id;
  const isSelf = req.admin.adminId.toString() === targetAdminId;
  const isSuperAdmin = req.admin.role === 'superadmin';

  if (!isSelf && !isSuperAdmin) {
    logger.warn(`Self-access violation: User ${req.admin.adminId} attempted to access resources for ${targetAdminId}`);
    return errorResponse(res, 403, 'You can only access your own resources unless you are a super admin', 'SELF_ACCESS_REQUIRED');
  }

  next();
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return errorResponse(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    const permissions = {
      'create_admin':      ['superadmin'],
      'delete_admin':      ['superadmin'],
      'view_all_admins':   ['superadmin'],
      'manage_settings':   ['superadmin'],
      'view_analytics':    ['admin', 'superadmin'],
      'manage_content':    ['admin', 'superadmin'],
      'security_audit':    ['superadmin'],
      'cleanup_tokens':    ['superadmin']
    };

    const allowedRoles = permissions[permission] || [];

    if (!allowedRoles.includes(req.admin.role)) {
      logger.warn(`Permission denied: ${req.admin.username} (${req.admin.role}) attempted ${permission}`);
      return errorResponse(res, 403, `Permission denied: ${permission}`, 'PERMISSION_DENIED', {
        permission,
        userRole: req.admin.role,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

  if (!apiKey) {
    return errorResponse(res, 401, 'API key required', 'API_KEY_MISSING');
  }

  if (!validApiKeys.includes(apiKey)) {
    logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 10)}... from IP: ${req.ip}`);
    return errorResponse(res, 401, 'Invalid API key', 'INVALID_API_KEY');
  }

  next();
};

// FIX 7: patch res.json instead of res.send — safe for all response types including CSV
const logAdminAction = (action) => (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = function (data) {
    if (data?.success) {
      logger.info(
        `Admin action: ${action} by ${req.admin?.username ?? 'unknown'} from IP: ${req.ip}`
      );
    }
    return orig(data);
  };
  next();
};

const validateOrigin = (allowedOrigins = []) => {
  return (req, res, next) => {
    const origin = req.get('Origin');

    if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
      logger.warn(`Blocked request from unauthorized origin: ${origin} to ${req.path}`);
      return errorResponse(res, 403, 'Request from unauthorized origin', 'UNAUTHORIZED_ORIGIN');
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  authRateLimit,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  adminAuth,
  superAdminAuth,
  requireSelfOrSuperAdmin,
  requirePermission,
  validateApiKey,
  validateOrigin,
  logAdminAction,
  clearAdminCache,
  cleanupCache,
  getCacheSize: () => adminCache.size,
  errorResponse
};