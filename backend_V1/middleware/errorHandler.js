const { logger } = require('../utils/helpers');

// Error classification
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
  DATABASE: 'DATABASE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR'
};

// Security-sensitive errors that should be logged with high priority
const SecurityErrors = [
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'RATE_LIMIT_EXCEEDED',
  'CORS_VIOLATION'
];

// Helper function to determine if error contains sensitive information
const containsSensitiveData = (error) => {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /authorization/i
  ];
  
  const errorString = JSON.stringify(error);
  return sensitivePatterns.some(pattern => pattern.test(errorString));
};

// Helper function to sanitize error for client response
const sanitizeErrorForClient = (error) => {
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  let sanitized = { ...error };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      delete sanitized[field];
    }
  });
  
  return sanitized;
};

// Helper function to get error type based on error properties
const getErrorType = (error) => {
  // Mongoose validation errors
  if (error.name === 'ValidationError' || error.name === 'ValidatorError') {
    return ErrorTypes.VALIDATION;
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return ErrorTypes.AUTHENTICATION;
  }
  
  // Mongoose cast errors
  if (error.name === 'CastError') {
    return ErrorTypes.VALIDATION;
  }
  
  // MongoDB duplicate key error
  if (error.code === 11000) {
    return ErrorTypes.VALIDATION;
  }
  
  // Rate limiting errors
  if (error.type === 'rate-limit-exceeded') {
    return ErrorTypes.RATE_LIMIT;
  }
  
  // MongoDB connection errors
  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    return ErrorTypes.DATABASE;
  }
  
  // Network/timeout errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return ErrorTypes.NETWORK;
  }
  
  // Authorization errors
  if (error.status === 403 || error.statusCode === 403) {
    return ErrorTypes.AUTHORIZATION;
  }
  
  // Not found errors
  if (error.status === 404 || error.statusCode === 404) {
    return ErrorTypes.NOT_FOUND;
  }
  
  return ErrorTypes.INTERNAL;
};

// Main error handler middleware
const errorHandler = (error, req, res, next) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }
  
  const requestId = req.requestId || 'unknown';
  const errorType = getErrorType(error);
  const isSecurityError = SecurityErrors.includes(errorType);
  
  // Create error context for logging
  const errorContext = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    adminId: req.admin?.adminId,
    timestamp: new Date().toISOString(),
    errorType,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  };
  
  // Log error with appropriate level
  const logLevel = isSecurityError ? 'error' : 'warn';
  const logMessage = `[${requestId}] ${errorType}: ${error.message}`;
  
  // Don't log sensitive information
  const sanitizedError = containsSensitiveData(error) ? 
    { ...error, message: 'Sensitive error occurred' } : error;
  
  logger[logLevel](logMessage, {
    ...errorContext,
    error: process.env.NODE_ENV === 'production' ? 
      { name: sanitizedError.name, message: sanitizedError.message } : 
      sanitizedError
  });
  
  // Prepare client response
  let statusCode = 500;
  let clientMessage = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';
  let details = {};
  
  // Handle specific error types
  switch (errorType) {
    case ErrorTypes.VALIDATION:
      statusCode = 400;
      
      if (error.name === 'ValidationError') {
        // Mongoose validation error
        clientMessage = 'Validation failed';
        errorCode = 'VALIDATION_FAILED';
        details.errors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));
      } else if (error.name === 'CastError') {
        // Mongoose cast error
        clientMessage = 'Invalid data format';
        errorCode = 'INVALID_FORMAT';
        details.field = error.path;
        details.value = error.value;
      } else if (error.code === 11000) {
        // MongoDB duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        clientMessage = `Duplicate ${field} - this value already exists`;
        errorCode = 'DUPLICATE_VALUE';
        details.field = field;
      } else {
        clientMessage = error.message || 'Validation error';
        errorCode = 'VALIDATION_ERROR';
      }
      break;
      
    case ErrorTypes.AUTHENTICATION:
      statusCode = 401;
      errorCode = 'AUTHENTICATION_FAILED';
      
      if (error.name === 'TokenExpiredError') {
        clientMessage = 'Access token expired';
        errorCode = 'TOKEN_EXPIRED';
        details.expiredAt = error.expiredAt;
      } else if (error.name === 'JsonWebTokenError') {
        clientMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else {
        clientMessage = error.message || 'Authentication failed';
      }
      break;
      
    case ErrorTypes.AUTHORIZATION:
      statusCode = 403;
      clientMessage = 'Access denied';
      errorCode = 'ACCESS_DENIED';
      break;
      
    case ErrorTypes.NOT_FOUND:
      statusCode = 404;
      clientMessage = error.message || 'Resource not found';
      errorCode = 'NOT_FOUND';
      break;
      
    case ErrorTypes.RATE_LIMIT:
      statusCode = 429;
      clientMessage = 'Rate limit exceeded';
      errorCode = 'RATE_LIMIT_EXCEEDED';
      details.retryAfter = error.retryAfter;
      break;
      
    case ErrorTypes.DATABASE:
      statusCode = 503;
      clientMessage = 'Database service unavailable';
      errorCode = 'DATABASE_ERROR';
      
      // Don't expose database details in production
      if (process.env.NODE_ENV !== 'production') {
        details.databaseError = error.message;
      }
      break;
      
    case ErrorTypes.NETWORK:
      statusCode = 503;
      clientMessage = 'Service temporarily unavailable';
      errorCode = 'NETWORK_ERROR';
      break;
      
    default:
      // Use error status if available
      statusCode = error.status || error.statusCode || 500;
      clientMessage = process.env.NODE_ENV === 'production' ? 
        'Internal server error' : 
        (error.message || 'Internal server error');
      errorCode = 'INTERNAL_ERROR';
  }
  
  // Security: Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    clientMessage = 'Internal server error';
    details = {};
  }
  
  // Build response
  const response = {
    success: false,
    error: {
      message: clientMessage,
      code: errorCode,
      type: errorType,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId
    }
  };
  
  // Add details if present
  if (Object.keys(details).length > 0) {
    response.error.details = details;
  }
  
  // Add development-specific information
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.originalError = error.name;
  }
  
  // Send response
  res.status(statusCode).json(response);
  
  // Additional monitoring for critical errors
  if (statusCode >= 500) {
    // In production, you might want to send this to an error monitoring service
    // like Sentry, Bugsnag, etc.
    if (process.env.ERROR_MONITORING_URL) {
      // sendToMonitoringService(error, errorContext);
    }
  }
  
  // Security incident logging for suspicious activity
  if (isSecurityError) {
    logger.error('Security incident detected', {
      type: 'SECURITY_EVENT',
      errorType,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      adminId: req.admin?.adminId,
      timestamp: new Date().toISOString()
    });
  }
};

// 404 Not Found handler
const notFoundHandler = (req, res) => {
  const requestId = req.requestId || 'unknown';
  
  logger.warn(`[${requestId}] 404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  });
  
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      type: ErrorTypes.NOT_FOUND,
      statusCode: 404,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
};

// Async error wrapper for route handlers
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create custom error classes
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'ACCESS_DENIED');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncErrorHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ErrorTypes
};