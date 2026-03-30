// middleware/activityLogger.js
const ActivityLog = require('../models/ActivityLog');
const { getDeviceInfo } = require('../utils/helpers');

// Map of route patterns to actions
const routeActionMap = {
  'POST /api/admin/login': 'login',
  'POST /api/admin/logout': 'logout',
  'POST /api/admin/logout-all': 'logout_all',
  'POST /api/admin/refresh-token': 'refresh_token',
  'POST /api/admin/change-password': 'password_changed',
  'GET /api/admin/profile': 'profile_viewed',
  'PUT /api/admin/profile': 'profile_updated',
  'GET /api/admin/sessions': 'sessions_viewed',
  'DELETE /api/admin/sessions/:sessionId': 'session_revoked',
  'POST /api/admin/create': 'admin_created',
  'GET /api/admin/all': 'admins_viewed',
  'GET /api/admin/:adminId': 'admin_viewed',
  'PATCH /api/admin/:adminId/status': 'admin_status_changed',
  'DELETE /api/admin/:adminId': 'admin_deleted',
  'POST /api/admin/cleanup-tokens': 'tokens_cleaned',
  'GET /api/admin/security-audit': 'security_audit_viewed',
  'GET /api/admin/activity-logs': 'activity_logs_viewed',
  'POST /api/admin/forgot-password': 'password_reset_requested',
  'POST /api/admin/reset-password': 'password_reset_completed'
};

// Get action from route
const getActionFromRoute = (method, path) => {
  // First try exact match
  const exactKey = `${method} ${path}`;
  if (routeActionMap[exactKey]) {
    return routeActionMap[exactKey];
  }
  
  // Try pattern matching for parameterized routes
  for (const [pattern, action] of Object.entries(routeActionMap)) {
    const [patternMethod, patternPath] = pattern.split(' ');
    if (method !== patternMethod) continue;
    
    const regex = new RegExp('^' + patternPath.replace(/:[^/]+/g, '[^/]+') + '$');
    if (regex.test(path)) {
      return action;
    }
  }
  
  return null;
};

// Main activity logging middleware
const logActivity = (customAction = null) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Store original response methods
    const originalJson = res.json;
    const originalSend = res.send;
    
    let responseBody = null;
    let isLogged = false;

    // Override res.json to capture response
    res.json = function(data) {
      responseBody = data;
      return originalJson.call(this, data);
    };

    // Override res.send to capture response
    res.send = function(data) {
      if (!responseBody && typeof data === 'string') {
        try {
          responseBody = JSON.parse(data);
        } catch (e) {
          responseBody = { raw: data };
        }
      }
      return originalSend.call(this, data);
    };

    // Override res.end to log activity
    const originalEnd = res.end;
    res.end = async function(...args) {
      if (!isLogged) {
        isLogged = true;
        await logActivityToDatabase(req, res, customAction, startTime, responseBody);
      }
      return originalEnd.apply(this, args);
    };

    next();
  };
};

// Log activity to database
async function logActivityToDatabase(req, res, customAction, startTime, responseBody) {
  try {
    const adminId = req.admin?.adminId || req.adminDoc?._id;
    
    // Skip if no admin (public routes can be optionally logged)
    if (!adminId && !req.logPublicActivity) {
      return;
    }

    const deviceInfo = getDeviceInfo(req);
    const responseTime = Date.now() - startTime;
    const action = customAction || getActionFromRoute(req.method, req.path);
    
    if (!action) {
      return; // Skip if action cannot be determined
    }

    // Determine status
    let status = 'success';
    if (res.statusCode >= 400 && res.statusCode < 500) {
      status = 'warning';
    } else if (res.statusCode >= 500) {
      status = 'failure';
    }

    // Extract additional details
    const targetAdminId = req.params.adminId || req.params.id || req.body.targetAdminId;
    const actionDetails = generateActionDetails(action, req, responseBody);

    const logData = {
      adminId,
      action,
      actionDetails,
      targetAdminId,
      targetResource: req.params.sessionId || req.params.resourceId,
      status,
      metadata: {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.deviceType,
        location: deviceInfo.location,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        errorCode: responseBody?.code,
        errorMessage: status !== 'success' ? responseBody?.message : undefined
      }
    };

    await ActivityLog.logActivity(logData);
  } catch (error) {
    console.error('Activity logging error:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}

// Generate human-readable action details
function generateActionDetails(action, req, responseBody) {
  const username = req.admin?.username || 'Unknown';
  
  switch (action) {
    case 'login':
      return responseBody?.success 
        ? `Successful login` 
        : `Failed login attempt for ${req.body.username}`;
    
    case 'logout':
      return `Logged out from current session`;
    
    case 'logout_all':
      return `Logged out from all sessions`;
    
    case 'password_changed':
      return `Changed account password`;
    
    case 'password_reset_requested':
      return `Requested password reset for ${req.body.email || req.body.username}`;
    
    case 'password_reset_completed':
      return `Completed password reset`;
    
    case 'profile_updated':
      const fields = Object.keys(req.body).filter(k => k !== 'password').join(', ');
      return `Updated profile fields: ${fields}`;
    
    case 'admin_created':
      return `Created new admin: ${req.body.username} (${req.body.role})`;
    
    case 'admin_status_changed':
      return `Changed admin status to: ${req.body.status}`;
    
    case 'admin_deleted':
      return `Deleted admin account`;
    
    case 'session_revoked':
      return `Revoked session: ${req.params.sessionId}`;
    
    case 'tokens_cleaned':
      return `Cleaned up expired tokens`;
    
    default:
      return `Performed ${action.replace(/_/g, ' ')}`;
  }
}

// Log failed authentication attempts
const logFailedAuth = async (req, reason, username = null) => {
  try {
    const deviceInfo = getDeviceInfo(req);
    
    await ActivityLog.logActivity({
      adminId: null, // No admin ID for failed auth
      action: 'login_failed',
      actionDetails: `Failed login: ${reason}${username ? ` (username: ${username})` : ''}`,
      status: 'failure',
      metadata: {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.deviceType,
        location: deviceInfo.location,
        method: req.method,
        path: req.path,
        errorCode: 'AUTHENTICATION_FAILED',
        errorMessage: reason
      }
    });
  } catch (error) {
    console.error('Failed to log authentication failure:', error);
  }
};

// Log unauthorized access attempts
const logUnauthorizedAccess = async (req, reason) => {
  try {
    const deviceInfo = getDeviceInfo(req);
    const adminId = req.admin?.adminId;
    
    await ActivityLog.logActivity({
      adminId,
      action: 'unauthorized_access_attempt',
      actionDetails: `Unauthorized access: ${reason}`,
      status: 'warning',
      metadata: {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.deviceType,
        location: deviceInfo.location,
        method: req.method,
        path: req.path,
        errorCode: 'UNAUTHORIZED_ACCESS'
      }
    });
  } catch (error) {
    console.error('Failed to log unauthorized access:', error);
  }
};

// Log suspicious activity
const logSuspiciousActivity = async (req, description, adminId = null) => {
  try {
    const deviceInfo = getDeviceInfo(req);
    
    await ActivityLog.logActivity({
      adminId: adminId || req.admin?.adminId,
      action: 'suspicious_activity',
      actionDetails: description,
      status: 'warning',
      metadata: {
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.deviceType,
        location: deviceInfo.location,
        method: req.method,
        path: req.path
      }
    });
  } catch (error) {
    console.error('Failed to log suspicious activity:', error);
  }
};

module.exports = {
  logActivity,
  logFailedAuth,
  logUnauthorizedAccess,
  logSuspiciousActivity
};