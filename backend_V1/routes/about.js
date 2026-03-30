// ============================================
// FILE: routes/about.js (Improved Version)
// ============================================

const express = require('express');
const router = express.Router();
const expressAsyncHandler = require('express-async-handler');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');

const {
  getPublicAbout,
  getAbout,
  createAbout,
  updateAbout,
  toggleAboutStatus,
  deleteAbout,
  getAllAbout,
  validateAbout,
  uploadProfileImage,
  deleteProfileImage
} = require('../controllers/aboutController');

const { authenticateToken } = require('../middleware/admin');
const { uploadSingle } = require('../middleware/upload');
const { logger } = require('../utils/helpers');

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

const logRateLimitHandler = (message) => (req, res, next, options) => {
  logger.warn(`${message}: IP=${req.ip}, Path=${req.originalUrl}, User-Agent=${req.get('user-agent')}`);
  res.status(options.statusCode).json(options.message);
};

// Public routes - more permissive
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  handler: logRateLimitHandler('Public route rate limit exceeded'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Admin routes - moderate limits
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    message: 'Too many admin requests, please try again later.',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  handler: logRateLimitHandler('Admin route rate limit exceeded'),
  standardHeaders: true,
  legacyHeaders: false
});

// Upload routes - strict limits to prevent abuse
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Upload limit exceeded. Please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  handler: logRateLimitHandler('Upload route rate limit exceeded'),
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Sanitize user input to prevent XSS attacks
 */
function sanitizeInput(req, res, next) {
  const fieldsToSanitize = [
    'mainDescription',
    'secondaryDescription',
    'beyondCodeContent',
    'tagline',
    'name',
    'location',
    'experience',
    'beyondCodeTitle'
  ];

  for (const field of fieldsToSanitize) {
    if (req.body[field] && typeof req.body[field] === 'string') {
      req.body[field] = sanitizeHtml(req.body[field], {
        allowedTags: [], // No HTML tags allowed
        allowedAttributes: {}
      }).trim();
    }
  }

  // Sanitize nested arrays
  if (req.body.stats && Array.isArray(req.body.stats)) {
    req.body.stats = req.body.stats.map(stat => ({
      ...stat,
      label: sanitizeHtml(stat.label || '', { allowedTags: [], allowedAttributes: {} }).trim(),
      value: sanitizeHtml(stat.value || '', { allowedTags: [], allowedAttributes: {} }).trim()
    }));
  }

  if (req.body.values && Array.isArray(req.body.values)) {
    req.body.values = req.body.values.map(value => ({
      ...value,
      title: sanitizeHtml(value.title || '', { allowedTags: [], allowedAttributes: {} }).trim(),
      description: sanitizeHtml(value.description || '', { allowedTags: [], allowedAttributes: {} }).trim()
    }));
  }

  next();
}

/**
 * Log route access for monitoring
 */
function logAccess(routeType) {
  return (req, res, next) => {
    logger.info(`${routeType} route accessed: ${req.method} ${req.originalUrl} by ${req.admin?.username || 'public'}`);
    next();
  };
}

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   GET /api/about
 * @desc    Get public about content
 * @access  Public
 */
router.get(
  '/',
  publicRateLimit,
  logAccess('Public'),
  expressAsyncHandler(getPublicAbout)
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/about/admin
 * @desc    Get active about content (admin view)
 * @access  Private/Admin
 */
router.get(
  '/admin',
  authenticateToken,
  adminRateLimit,
  logAccess('Admin'),
  expressAsyncHandler(getAbout)
);

/**
 * @route   GET /api/about/admin/all
 * @desc    Get all about entries with pagination
 * @access  Private/Admin
 */
router.get(
  '/admin/all',
  authenticateToken,
  adminRateLimit,
  logAccess('Admin'),
  expressAsyncHandler(getAllAbout)
);

// ============================================
// IMAGE MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/about/admin/upload-image
 * @desc    Upload profile image
 * @access  Private/Admin
 */
router.post(
  '/admin/upload-image',
  authenticateToken,
  uploadRateLimit,
  logAccess('Admin Upload'),
  ...uploadSingle,
  expressAsyncHandler(uploadProfileImage)
);

/**
 * @route   DELETE /api/about/admin/image/:filename
 * @desc    Delete profile image
 * @access  Private/Admin
 */
router.delete(
  '/admin/image/:filename',
  authenticateToken,
  uploadRateLimit,
  logAccess('Admin Delete Image'),
  expressAsyncHandler(deleteProfileImage)
);

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * @route   POST /api/about/admin
 * @desc    Create new about content
 * @access  Private/Admin
 */
router.post(
  '/admin',
  authenticateToken,
  adminRateLimit,
  logAccess('Admin Create'),
  sanitizeInput,
  validateAbout,
  expressAsyncHandler(createAbout)
);

/**
 * @route   PUT /api/about/admin/:id
 * @desc    Update about content
 * @access  Private/Admin
 */
router.put(
  '/admin/:id',
  authenticateToken,
  adminRateLimit,
  logAccess('Admin Update'),
  sanitizeInput,
  validateAbout,
  expressAsyncHandler(updateAbout)
);

/**
 * @route   PATCH /api/about/admin/:id/toggle
 * @desc    Toggle active status
 * @access  Private/Admin
 */
router.patch(
  '/admin/:id/toggle',
  authenticateToken,
  adminRateLimit,
  logAccess('Admin Toggle'),
  expressAsyncHandler(toggleAboutStatus)
);

/**
 * @route   DELETE /api/about/admin/:id
 * @desc    Delete about content
 * @access  Private/Admin
 */
router.delete(
  '/admin/:id',
  authenticateToken,
  adminRateLimit,
  logAccess('Admin Delete'),
  expressAsyncHandler(deleteAbout)
);

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * 404 Handler for undefined routes
 */
router.use((req, res) => {
  logger.warn(`About route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'About route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
});

module.exports = router;