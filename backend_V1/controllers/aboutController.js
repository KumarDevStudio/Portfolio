const About = require('../models/About');
const { logger } = require('../utils/helpers');
const { body, validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');

/**
 * @desc    Get public about content
 * @route   GET /api/about
 * @access  Public
 */
exports.getPublicAbout = async (req, res, next) => {
  try {
    const about = await About.getPublic();

    if (!about) {
      return res.status(404).json({
        success: false,
        message: 'About content not found',
        code: 'ABOUT_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      data: about,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching public about:', error);
    next(error);
  }
};

/**
 * @desc    Get about content (Admin)
 * @route   GET /api/admin/about
 * @access  Private/Admin
 */
exports.getAbout = async (req, res, next) => {
  try {
    const about = await About.getActive();

    if (!about) {
      return res.status(404).json({
        success: false,
        message: 'About content not found',
        code: 'ABOUT_NOT_FOUND',
      });
    }

    res.status(200).json({ success: true, data: about });
  } catch (error) {
    logger.error('Error fetching about:', error);
    next(error);
  }
};

/**
 * @desc    Create about content
 * @route   POST /api/admin/about
 * @access  Private/Admin
 */
exports.createAbout = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const existingAbout = await About.findOne({ isActive: true });
    if (existingAbout) {
      return res.status(409).json({
        success: false,
        message: 'Active about content already exists. Please update or deactivate it first.',
        code: 'ABOUT_ALREADY_EXISTS',
      });
    }

    const aboutData = {
      ...req.body,
      metadata: {
        createdBy: req.admin.id,
        updatedBy: req.admin.id,
        version: 1,
      },
    };

    const about = await About.create(aboutData);
    logger.info(`About content created by admin: ${req.admin.username}`);

    res.status(201).json({
      success: true,
      message: 'About content created successfully',
      data: about,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
        })),
      });
    }
    logger.error('Error creating about:', error);
    next(error);
  }
};

/**
 * @desc    Upload profile image
 * @route   POST /api/admin/about/upload-image
 * @access  Private/Admin
 */
exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded',
        code: 'NO_IMAGE_UPLOADED',
      });
    }

    // multer-storage-cloudinary sets:
    //   req.file.path     → full Cloudinary HTTPS URL
    //   req.file.filename → public_id  (e.g. portfolio/about/file_xxx)
    const imageData = {
      filename:     req.file.filename,      // public_id for deletion later
      originalName: req.file.originalname,
      url:          req.file.path,          // Cloudinary URL — store this in DB
      fullUrl:      req.file.path,          // same
      size:         req.file.size,
      mimetype:     req.file.mimetype,
      uploadedAt:   new Date().toISOString(),
      uploadedBy:   req.admin.username,
    };

    logger.info(`Profile image uploaded to Cloudinary: ${req.file.filename} by ${req.admin.username}`);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: imageData,
    });
  } catch (error) {
    logger.error('Upload profile image error:', error);
    next(error);
  }
};

/**
 * @desc    Delete profile image
 * @route   DELETE /api/admin/about/image/:filename
 * @access  Private/Admin
 */
exports.deleteProfileImage = async (req, res, next) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
    }

    const filePath = path.resolve(__dirname, '..', 'uploads', filename);

    try {
      await fs.unlink(filePath);
      logger.info(`Profile image deleted: ${filename} by admin: ${req.admin.username}`);

      res.status(200).json({
        success: true,
        message: 'Image deleted successfully',
        data: { filename },
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          message: 'Image not found',
          code: 'IMAGE_NOT_FOUND',
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Delete profile image error:', error);
    next(error);
  }
};

/**
 * @desc    Update about content
 * @route   PUT /api/admin/about/:id
 * @access  Private/Admin
 */
exports.updateAbout = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const about = await About.findById(id);

    if (!about) {
      return res.status(404).json({
        success: false,
        message: 'About content not found',
        code: 'ABOUT_NOT_FOUND',
      });
    }

    const allowedFields = [
      'name', 'location', 'experience', 'imageUrl', 'imageAlt',
      'tagline', 'mainDescription', 'secondaryDescription',
      'beyondCodeTitle', 'beyondCodeContent', 'stats', 'values', 'isActive',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        about[field] = req.body[field];
      }
    }

    about.metadata.updatedBy = req.admin.id;
    about.metadata.version += 1;

    await about.save();
    logger.info(`About content updated by admin: ${req.admin.username}`);

    const updatedAbout = await About.findById(id)
      .populate('metadata.createdBy', 'username email')
      .populate('metadata.updatedBy', 'username email');

    res.status(200).json({
      success: true,
      message: 'About content updated successfully',
      data: updatedAbout,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
        })),
      });
    }
    logger.error('Error updating about:', error);
    next(error);
  }
};

/**
 * @desc    Toggle active status
 * @route   PATCH /api/admin/about/:id/toggle
 * @access  Private/Admin
 */
exports.toggleAboutStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const about = await About.findById(id);

    if (!about) {
      return res.status(404).json({
        success: false,
        message: 'About content not found',
        code: 'ABOUT_NOT_FOUND',
      });
    }

    // Deactivate all others if activating this one
    if (!about.isActive) {
      await About.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    about.isActive = !about.isActive;
    about.metadata.updatedBy = req.admin.id;
    await about.save();

    logger.info(`About status toggled by admin: ${req.admin.username}`);

    res.status(200).json({
      success: true,
      message: `About content ${about.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: about.isActive },
    });
  } catch (error) {
    logger.error('Error toggling about status:', error);
    next(error);
  }
};

/**
 * @desc    Delete about content
 * @route   DELETE /api/admin/about/:id
 * @access  Private/Admin
 */
exports.deleteAbout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const about = await About.findById(id);

    if (!about) {
      return res.status(404).json({
        success: false,
        message: 'About content not found',
        code: 'ABOUT_NOT_FOUND',
      });
    }

    if (about.imageUrl?.startsWith('/uploads/')) {
      const filename = path.basename(about.imageUrl);
      const filePath = path.resolve(__dirname, '..', 'uploads', filename);

      try {
        await fs.unlink(filePath);
        logger.info(`Deleted associated image: ${filename}`);
      } catch (err) {
        logger.warn(`Could not delete image: ${filename}`, err);
      }
    }

    await about.deleteOne();
    logger.info(`About content deleted by admin: ${req.admin.username}`);

    res.status(200).json({
      success: true,
      message: 'About content deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting about:', error);
    next(error);
  }
};

/**
 * @desc    Get all about entries (including inactive)
 * @route   GET /api/admin/about/all
 * @access  Private/Admin
 */
exports.getAllAbout = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      About.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('metadata.createdBy', 'username email')
        .populate('metadata.updatedBy', 'username email')
        .lean(),
      About.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        entries,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching all about entries:', error);
    next(error);
  }
};

/* ===========================
   ✅ IMPROVED Validation Rules
=========================== */

// Helper function to validate stat object structure
const validateStatStructure = (stat, index) => {
  const errors = [];
  
  if (!stat.icon || typeof stat.icon !== 'string') {
    errors.push(`Stats[${index}]: icon is required and must be a string`);
  }
  
  if (!stat.label || typeof stat.label !== 'string') {
    errors.push(`Stats[${index}]: label is required and must be a string`);
  } else if (stat.label.length > 50) {
    errors.push(`Stats[${index}]: label cannot exceed 50 characters`);
  }
  
  if (!stat.value || typeof stat.value !== 'string') {
    errors.push(`Stats[${index}]: value is required and must be a string`);
  } else if (stat.value.length > 100) {
    errors.push(`Stats[${index}]: value cannot exceed 100 characters`);
  }
  
  if (!stat.color || typeof stat.color !== 'string') {
    errors.push(`Stats[${index}]: color is required and must be a string`);
  }
  
  if (stat.order === undefined || typeof stat.order !== 'number') {
    errors.push(`Stats[${index}]: order is required and must be a number`);
  }
  
  return errors;
};

// Helper function to validate value object structure
const validateValueStructure = (value, index) => {
  const errors = [];
  
  if (!value.icon || typeof value.icon !== 'string') {
    errors.push(`Values[${index}]: icon is required and must be a string`);
  }
  
  if (!value.title || typeof value.title !== 'string') {
    errors.push(`Values[${index}]: title is required and must be a string`);
  } else if (value.title.length > 50) {
    errors.push(`Values[${index}]: title cannot exceed 50 characters`);
  }
  
  if (!value.description || typeof value.description !== 'string') {
    errors.push(`Values[${index}]: description is required and must be a string`);
  } else if (value.description.length > 200) {
    errors.push(`Values[${index}]: description cannot exceed 200 characters`);
  }
  
  if (value.order === undefined || typeof value.order !== 'number') {
    errors.push(`Values[${index}]: order is required and must be a number`);
  }
  
  return errors;
};

exports.validateAbout = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  
  body('experience')
    .trim()
    .notEmpty()
    .withMessage('Experience is required')
    .isLength({ max: 50 })
    .withMessage('Experience cannot exceed 50 characters'),
  
  body('tagline')
    .trim()
    .notEmpty()
    .withMessage('Tagline is required')
    .isLength({ max: 200 })
    .withMessage('Tagline cannot exceed 200 characters'),
  
  body('mainDescription')
    .trim()
    .notEmpty()
    .withMessage('Main description is required')
    .isLength({ max: 1000 })
    .withMessage('Main description cannot exceed 1000 characters'),
  
  body('secondaryDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Secondary description cannot exceed 500 characters'),
  
  body('beyondCodeTitle')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Beyond code title cannot exceed 100 characters'),
  
  body('beyondCodeContent')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Beyond code content cannot exceed 500 characters'),
  
  body('imageUrl')
    .optional({ checkFalsy: true })
    .trim()
    .custom((value) => {
      // Allow data URLs or regular URLs
      if (value.startsWith('data:')) {
        return true;
      }
      // Basic URL validation
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Invalid image URL');
      }
    }),
  
  body('imageAlt')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Image alt text cannot exceed 200 characters'),
  
  body('stats')
    .optional()
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('Stats must be an array');
      }
      
      if (value.length > 6) {
        throw new Error('Cannot have more than 6 stats');
      }
      
      const allErrors = [];
      value.forEach((stat, index) => {
        const errors = validateStatStructure(stat, index);
        allErrors.push(...errors);
      });
      
      if (allErrors.length > 0) {
        throw new Error(allErrors.join('; '));
      }
      
      return true;
    }),
  
  body('values')
    .optional()
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('Values must be an array');
      }
      
      if (value.length > 8) {
        throw new Error('Cannot have more than 8 values');
      }
      
      const allErrors = [];
      value.forEach((val, index) => {
        const errors = validateValueStructure(val, index);
        allErrors.push(...errors);
      });
      
      if (allErrors.length > 0) {
        throw new Error(allErrors.join('; '));
      }
      
      return true;
    }),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];