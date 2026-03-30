// =====================================================
// routes/profile.js
// Fixed: Added missing logger import and ipKeyGenerator
// =====================================================

const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/ProfileController');
const { authenticateToken } = require('../middleware/admin');
const { uploadSingle } = require('../middleware/upload');
const { strictRateLimit } = require('../middleware/security');
const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/helpers'); // ✅ ADDED: Import logger
const rateLimit = require('express-rate-limit');

// ===========================
// HELPER FUNCTIONS
// ===========================

// ✅ ADDED: IPv6-safe key generator
const ipKeyGenerator = (req) => {
  const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
  // Normalize IPv6 addresses
  return ip.replace(/^::ffff:/, '');
};

// ===========================
// CUSTOM RATE LIMITERS
// ===========================

// Lenient rate limiter for uploads (to allow retries)
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 1000 : 50,
  skipSuccessfulRequests: true, // Only count failed requests
  message: {
    success: false,
    message: 'Too many upload attempts. Please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to track by user, not just IP
  keyGenerator: (req) => {
    return req.admin?.adminId || ipKeyGenerator(req);
  },
  handler: (req, res) => {
    const timeRemaining = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60);
    logger.warn('Upload rate limit exceeded', {
      service: 'portfolio-api',
      ip: req.ip,
      path: req.path,
      adminId: req.admin?.adminId
    });
    res.status(429).json({
      success: false,
      message: `Too many upload attempts. Try again in ${timeRemaining} minutes.`,
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: timeRemaining * 60
    });
  }
});

// ===========================
// VALIDATION MIDDLEWARE
// ===========================

const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be 5-100 characters'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Bio must be 10-2000 characters'),
  
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title must not exceed 60 characters'),
  
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description must not exceed 160 characters'),
  
  body('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished must be a boolean'),
  
  body('socialLinks.github')
    .optional()
    .trim()
    .custom((value) => {
      // Allow empty strings
      if (value === '') return true;
      // Validate URL if provided
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('GitHub URL must be valid');
      }
    }),
  
  body('socialLinks.linkedin')
    .optional()
    .trim()
    .custom((value) => {
      if (value === '') return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('LinkedIn URL must be valid');
      }
    }),
  
  body('socialLinks.twitter')
    .optional()
    .trim()
    .custom((value) => {
      if (value === '') return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Twitter URL must be valid');
      }
    }),
  
  body('socialLinks.email')
    .optional()
    .trim()
    .custom((value) => {
      // Allow empty strings
      if (value === '') return true;
      // Validate email if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Email must be valid');
      }
      return true;
    }),
  
  body('socialLinks.website')
    .optional()
    .trim()
    .custom((value) => {
      if (value === '') return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Website URL must be valid');
      }
    }),
  
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),
  
  body('features.*.title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Feature title must be 2-50 characters'),
  
  body('features.*.description')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Feature description must be 5-200 characters'),
  
  body('features.*.icon')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Feature icon must be 1-50 characters'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Profile validation failed', {
        service: 'portfolio-api',
        adminId: req.admin?.adminId,
        errors: errors.array(),
        requestId: req.requestId
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

// ===========================
// PUBLIC ROUTES
// ===========================

router.get('/public', ProfileController.getPublicProfile);
router.get('/resume', ProfileController.downloadResume); // Clean URL

// ===========================
// ADMIN ROUTES (PROTECTED)
// ===========================

// Get admin profile
router.get('/', 
  authenticateToken, 
  ProfileController.getAdminProfile
);

// Update profile information
router.put('/', 
  authenticateToken,
  strictRateLimit,
  validateProfileUpdate,
  ProfileController.updateProfile
);

// Upload profile image
router.post('/image',
  authenticateToken,
  uploadRateLimit,
  ...uploadSingle,
  ProfileController.uploadProfileImage
);

// Upload resume
router.post('/resume',
  authenticateToken,
  uploadRateLimit,
  ...uploadSingle,
  ProfileController.uploadResume
);

// Delete operations
router.delete('/image',
  authenticateToken,
  strictRateLimit,
  ProfileController.deleteProfileImage
);

router.delete('/resume',
  authenticateToken,
  strictRateLimit,
  ProfileController.deleteResume
);

// ===========================
// ERROR HANDLING
// ===========================

router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large',
      code: 'FILE_TOO_LARGE',
      maxSize: error.field === 'resume' ? '10MB' : '5MB'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected field name',
      code: 'INVALID_FIELD',
      expectedField: error.field
    });
  }
  
  next(error);
});

module.exports = router;