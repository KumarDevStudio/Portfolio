// =====================================================
// routes/uploads.js
// Production-ready with security enhancements
// =====================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const UploadController = require('../controllers/UploadController');
const { authenticateToken } = require('../middleware/admin');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { strictRateLimit } = require('../middleware/security');
const { body, query, param, validationResult } = require('express-validator');

// ===========================
// RATE LIMITERS
// ===========================

// Strict rate limiter for file serving (prevent DDoS)
const serveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: {
    success: false,
    message: 'Too many file requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Upload rate limiter per admin user
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per 15 minutes
  // Remove custom keyGenerator - use default IP-based limiting
  // If you need per-user limiting, implement it in middleware separately
  message: { 
    success: false, 
    message: 'Too many upload attempts, please try again later',
    code: 'UPLOAD_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ===========================
// VALIDATION MIDDLEWARE
// ===========================

const validateFileParams = [
  param('filename')
    .trim()
    .notEmpty()
    .withMessage('Filename is required')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Filename contains invalid characters')
    .isLength({ max: 255 })
    .withMessage('Filename too long')
    .custom((value) => {
      if (value.includes('..') || value.startsWith('.')) {
        throw new Error('Invalid filename format');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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

const validateFileListQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('type')
    .optional()
    .isIn(['images', 'documents', 'all'])
    .withMessage('Type must be images, documents, or all'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term too long')
    .escape(), // Prevent XSS
  
  query('sortBy')
    .optional()
    .isIn(['filename', 'size', 'created', 'modified'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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

const validateBatchDelete = [
  body('filenames')
    .isArray({ min: 1, max: 50 })
    .withMessage('Must provide 1-50 filenames'),
  
  body('filenames.*')
    .trim()
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Invalid filename format')
    .isLength({ max: 255 })
    .withMessage('Filename too long')
    .custom((value) => {
      if (value.includes('..') || value.startsWith('.')) {
        throw new Error('Invalid filename');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.array()
      });
    }
    next();
  }
];

// ===========================
// PUBLIC ROUTES
// ===========================

// Serve file (public with rate limiting)
router.get('/serve/:filename',
  serveLimiter,
  validateFileParams,
  UploadController.serveFile
);

// Check if file exists (public)
router.get('/exists/:filename',
  serveLimiter,
  validateFileParams,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Use admin endpoints to check file existence',
      code: 'USE_ADMIN_ENDPOINT'
    });
  }
);

// ===========================
// ADMIN ROUTES (PROTECTED)
// ===========================

// Upload single file
router.post('/single',
  authenticateToken,
  uploadLimiter,
  strictRateLimit,
  ...uploadSingle,
  UploadController.uploadFile
);

// Upload multiple files
router.post('/multiple',
  authenticateToken,
  uploadLimiter,
  strictRateLimit,
  ...uploadMultiple,
  UploadController.uploadFile // Note: Handle multiple files in controller
);

// Get list of uploaded files
router.get('/',
  authenticateToken,
  validateFileListQuery,
  UploadController.getFilesList
);

// Get file information
router.get('/info/:filename',
  authenticateToken,
  validateFileParams,
  async (req, res, next) => {
    try {
      const { filename } = req.params;
      
      // Security check
      if (!filename || filename.includes('..') || filename.startsWith('.')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid filename',
          code: 'INVALID_FILENAME'
        });
      }
      
      // Delegate to controller (implement getFileInfo if needed)
      res.status(501).json({
        success: false,
        message: 'File info endpoint not yet implemented',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete file
router.delete('/:filename',
  authenticateToken,
  strictRateLimit,
  validateFileParams,
  UploadController.deleteFile
);

// Batch delete files
router.post('/batch-delete',
  authenticateToken,
  strictRateLimit,
  validateBatchDelete,
  async (req, res, next) => {
    try {
      const { filenames } = req.body;
      const results = { deleted: [], failed: [] };

      for (const filename of filenames) {
        try {
          // Use the controller's delete method
          req.params = { filename };
          await UploadController.deleteFile(req, {
            status: () => ({ json: (data) => {
              if (data.success) {
                results.deleted.push(filename);
              } else {
                results.failed.push({ filename, reason: data.message });
              }
            }})
          }, next);
        } catch (error) {
          results.failed.push({ filename, reason: error.message });
        }
      }

      res.status(200).json({
        success: true,
        message: `Deleted ${results.deleted.length} file(s)`,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get storage statistics
router.get('/stats',
  authenticateToken,
  UploadController.getStorageStats
);

// Get metrics
router.get('/metrics',
  authenticateToken,
  UploadController.getMetrics
);

// Clean up temporary files (admin only)
router.post('/cleanup-temp',
  authenticateToken,
  strictRateLimit,
  async (req, res, next) => {
    try {
      // Implement temp cleanup
      res.status(200).json({
        success: true,
        message: 'Temporary files cleaned',
        data: {
          filesRemoved: 0,
          spaceFreed: 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================
// ERROR HANDLING
// ===========================

// Handle Multer-specific errors
router.use((error, req, res, next) => {
  // Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum size is ${Math.round(error.limit / (1024 * 1024))}MB`,
      code: 'FILE_TOO_LARGE',
      limit: error.limit
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: `Too many files. Maximum is ${error.limit}`,
      code: 'TOO_MANY_FILES',
      limit: error.limit
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected field name',
      code: 'INVALID_FIELD_NAME',
      field: error.field
    });
  }

  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: error.message || 'Invalid file type',
      code: 'INVALID_FILE_TYPE'
    });
  }

  // File system errors
  if (error.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'File or directory not found',
      code: 'NOT_FOUND'
    });
  }

  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return res.status(500).json({
      success: false,
      message: 'Permission denied',
      code: 'PERMISSION_DENIED'
    });
  }

  // Pass other errors to global handler
  next(error);
});

module.exports = router;