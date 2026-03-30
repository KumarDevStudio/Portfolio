// =====================================================
// controllers/ProfileController.js
// Production-ready with security fixes and retry logic
// =====================================================

const Profile = require('../models/Profile');
const { successResponse, errorResponse, logger } = require('../utils/helpers');
const path = require('path');
const fs = require('fs').promises;
const cloudinary = require('../config/cloudinary');

class ProfileController {
  constructor() {
    this._verifyCloudinaryConfig();

    // Bind methods
    Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor')
      .forEach(method => {
        this[method] = this[method].bind(this);
      });

    // Configuration
    this.MAX_UPLOAD_RETRIES = 2;
    this.RETRY_DELAY_MS = 1000;
  }

  _verifyCloudinaryConfig() {
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      logger.error('Cloudinary configuration missing!', {
        service: 'portfolio-api',
        hasCloudName: !!config.cloud_name,
        hasApiKey: !!config.api_key,
        hasApiSecret: !!config.api_secret
      });
    } else {
      logger.info('Cloudinary configuration verified', {
        service: 'portfolio-api',
        cloudName: config.cloud_name
      });
    }
  }




  // ===========================
  // HELPER METHODS
  // ===========================

  _ensureDefaultFeatures(profile) {
    if (!profile.features || profile.features.length === 0) {
      profile.features = [
        { title: 'MERN Stack', icon: 'Code', description: 'Full stack development' },
        { title: 'Scalability', icon: 'Rocket', description: 'Building scalable apps' },
        { title: 'Security', icon: 'Shield', description: 'Secure coding practices' }
      ];
    }
  }

  async _cleanupLocalFile(filePath) {
    if (!filePath) return;
    
    try {
      await fs.unlink(filePath);
      logger.debug(`Cleaned up local file: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup local file: ${filePath}`, { message: error.message });
    }
  }

  async _getProfile() {
    const profile = await Profile.findOne({ isCurrent: true });
    if (!profile) {
      throw new Error('PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async _uploadToCloudinaryWithRetry(filePath, options) {
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      throw new Error('Cloudinary configuration missing - check .env and restart server');
    }

    let lastError;
    
    for (let attempt = 0; attempt <= this.MAX_UPLOAD_RETRIES; attempt++) {
      try {
        const result = await cloudinary.uploader.upload(filePath, {
          ...options,
          timeout: 60000
        });
        
        if (attempt > 0) {
          logger.info(`Upload succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.MAX_UPLOAD_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt);
          logger.warn(`Upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
            service: 'portfolio-api',
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error(`Cloudinary upload failed after ${this.MAX_UPLOAD_RETRIES + 1} attempts`, {
      service: 'portfolio-api',
      message: lastError.message,
      code: lastError.code,
      statusCode: lastError.statusCode,
      filePath,
      options: { folder: options.folder, resource_type: options.resource_type }
    });
    
    throw new Error(`Cloudinary upload failed after ${this.MAX_UPLOAD_RETRIES + 1} attempts: ${lastError.message}`);
  }

  async _safeCloudinaryDelete(publicId, options = {}) {
    if (!publicId) return;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await cloudinary.uploader.destroy(publicId, options);
        logger.info(`Deleted from Cloudinary: ${publicId}`, { 
          service: 'portfolio-api', 
          requestId: options.requestId 
        });
        return;
      } catch (error) {
        logger.warn(`Failed to delete from Cloudinary: ${publicId} (attempt ${attempt + 1})`, {
          service: 'portfolio-api',
          requestId: options.requestId,
          message: error.message,
          code: error.http_code || error.code
        });
        if (attempt < maxRetries && error.http_code === 429) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        } else {
          break;
        }
      }
    }
  }

  // ===========================
  // PUBLIC PROFILE
  // ===========================

async downloadResume(req, res, next) {
  try {
    const profile = await Profile.findOne({ isCurrent: true, isPublished: true })
      .select('resume')
      .lean();

    if (!profile?.resume?.publicId) {
      return res.status(404).json({
        success: false,
        message: 'Resume not available'
      });
    }

    const publicId = profile.resume.publicId;
    
    // Build authenticated Cloudinary URL
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudinary.config().cloud_name}/resources/raw/upload/${publicId}`;
    
    const https = require('https');
    const url = require('url');
    const parsedUrl = url.parse(cloudinaryUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${cloudinary.config().api_key}:${cloudinary.config().api_secret}`
        ).toString('base64')}`
      }
    };

    https.get(options, (cloudinaryRes) => {
      if (cloudinaryRes.statusCode !== 200) {
        logger.error('Cloudinary fetch failed', {
          statusCode: cloudinaryRes.statusCode,
          publicId
        });
        return res.status(502).json({
          success: false,
          message: 'Resume temporarily unavailable'
        });
      }

      // Stream file with clean filename
      const filename = profile.resume.filename || 'resume.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      
      cloudinaryRes.pipe(res);

      logger.info('Resume downloaded', {
        service: 'portfolio-api',
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    }).on('error', (error) => {
      logger.error('Resume download error', {
        message: error.message,
        publicId
      });
      return res.status(500).json({
        success: false,
        message: 'Download failed'
      });
    });

  } catch (error) {
    logger.error('Resume endpoint error', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

// Update getPublicProfile to return clean download URL
async getPublicProfile(req, res, next) {
  try {
    const profile = await Profile.findOne({ 
      isCurrent: true, 
      isPublished: true 
    })
    .select('-__v -createdAt -updatedAt -isCurrent -isPublished')
    .lean();

    if (!profile) {
      return errorResponse(res, 404, 'Profile not found', 'PROFILE_NOT_FOUND');
    }

    // Replace Cloudinary URL with clean proxy URL
    if (profile.resume?.publicId) {
      profile.resume.downloadUrl = '/api/resume';
      delete profile.resume.url; // Remove Cloudinary URL
      delete profile.resume.publicId; // Hide internal reference
    }

    res.set('Cache-Control', 'public, max-age=300');
    return successResponse(res, 'Profile retrieved successfully', profile);
    
  } catch (error) {
    logger.error('Get public profile error:', { 
      message: error.message, 
      stack: error.stack 
    });
    next(error);
  }
}

  // ===========================
  // ADMIN PROFILE MANAGEMENT
  // ===========================

  async getAdminProfile(req, res, next) {
    try {
      const profile = await Profile.findOne({ isCurrent: true });

      if (!profile) {
        return errorResponse(res, 404, 'Profile not found', 'PROFILE_NOT_FOUND');
      }

      return successResponse(res, 'Profile retrieved successfully', profile);
    } catch (error) {
      logger.error('Get admin profile error:', { message: error.message, stack: error.stack });
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      logger.info('Update profile request:', {
        service: 'portfolio-api',
        body: JSON.stringify(req.body, null, 2),
        adminId: req.admin?.adminId,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });

      const {
        firstName,
        lastName,
        title,
        bio,
        socialLinks,
        features,
        metaTitle,
        metaDescription,
        isPublished
      } = req.body;

      let profile = await Profile.findOne({ isCurrent: true });

      if (!profile) {
        profile = new Profile({
          firstName: firstName || 'John',
          lastName: lastName || 'Doe',
          title: title || 'Full Stack Developer',
          bio: bio || 'Passionate developer',
          socialLinks: socialLinks || {},
          features: features || [],
          isCurrent: true,
          isPublished: isPublished !== undefined ? isPublished : false,
          metaTitle: metaTitle || '',
          metaDescription: metaDescription || ''
        });
      } else {
        if (firstName !== undefined) profile.firstName = firstName;
        if (lastName !== undefined) profile.lastName = lastName;
        if (title !== undefined) profile.title = title;
        if (bio !== undefined) profile.bio = bio;
        if (socialLinks !== undefined) {
          if (typeof socialLinks !== 'object' || Array.isArray(socialLinks) || socialLinks === null) {
            throw new Error('socialLinks must be a non-null object');
          }
          // Clean socialLinks - convert empty strings to actual empty strings (valid)
          const cleanedSocialLinks = {};
          Object.keys(socialLinks).forEach(key => {
            const value = socialLinks[key];
            // Allow empty strings, just ensure it's a string
            cleanedSocialLinks[key] = typeof value === 'string' ? value : '';
          });
          
          profile.socialLinks = { 
            ...profile.socialLinks.toObject?.() || profile.socialLinks, 
            ...cleanedSocialLinks 
          };
        }
        if (features !== undefined) {
          if (!Array.isArray(features)) {
            throw new Error('features must be an array');
          }
          
          // Handle both 'text' and 'title' field names during migration
          const cleanedFeatures = features.map((feature) => {
            const icon = feature.icon || 'Code';
            // Accept both 'title' and 'text', preferring 'title'
            const title = feature.title || feature.text || '';
            const description = feature.description || '';
            
            // Validate non-empty fields
            if (!icon.trim() || !title.trim() || !description.trim()) {
              throw new Error('All features must have non-empty icon, title, and description');
            }
            
            return { icon, title, description };
          });
          
          profile.features = cleanedFeatures;
        }
        if (metaTitle !== undefined) profile.metaTitle = metaTitle;
        if (metaDescription !== undefined) profile.metaDescription = metaDescription;
        if (isPublished !== undefined) profile.isPublished = isPublished;
      }

      try {
        await profile.save();
      } catch (saveError) {
        logger.error('Profile save error:', {
          service: 'portfolio-api',
          message: saveError.message,
          errors: saveError.errors,
          stack: saveError.stack,
          profileData: JSON.stringify(profile.toObject(), null, 2),
          requestId: req.requestId
        });
        throw saveError;
      }

      logger.info(`Profile updated by admin: ${req.admin?.adminId}`, {
        service: 'portfolio-api',
        fields: Object.keys(req.body),
        adminId: req.admin?.adminId,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });

      return successResponse(res, 'Profile updated successfully', profile);
    } catch (error) {
      logger.error('Update profile error:', {
        service: 'portfolio-api',
        message: error.message,
        stack: error.stack,
        body: JSON.stringify(req.body, null, 2),
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      if (error.name === 'ValidationError') {
        return errorResponse(res, 400, 'Validation failed', 'VALIDATION_ERROR', { 
          errors: error.errors 
        });
      }
      return errorResponse(res, 400, error.message, 'INVALID_INPUT');
    }
  }

async _makeFilePublic(publicId, resourceType = 'raw') {
  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      resource_type: resourceType,
      access_mode: 'public'
    });
    logger.info(`Made file public: ${publicId}`, {
      service: 'portfolio-api',
      access_mode: result.access_mode
    });
    return result;
  } catch (error) {
    logger.error(`Failed to make file public: ${publicId}`, {
      service: 'portfolio-api',
      message: error.message,
      code: error.http_code || error.code
    });
    throw error;
  }
}
  async uploadProfileImage(req, res, next) {
    const localFilePath = req.file?.path;
    let oldPublicId = null;

    try {
      if (!req.file) {
        return errorResponse(res, 400, 'No image file provided', 'NO_FILE');
      }

      const validation = req.fileValidation?.[0];
      if (validation && !validation.valid) {
        await this._cleanupLocalFile(localFilePath);
        return errorResponse(res, 400, validation.error || 'File validation failed', 'VALIDATION_FAILED');
      }

      const profile = await this._getProfile();
      oldPublicId = profile.profileImage?.publicId;

      const result = await this._uploadToCloudinaryWithRetry(localFilePath, {
        folder: 'portfolio/profile',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ],
        resource_type: 'image',
        type: 'upload',  // ✅ Explicitly set type to 'upload' (public)
        access_mode: 'public'  // ✅ Ensure public access
      });

      profile.profileImage = {
        url: result.secure_url,
        publicId: result.public_id
      };

      await profile.save();
      await this._cleanupLocalFile(localFilePath);

      if (oldPublicId) {
        this._safeCloudinaryDelete(oldPublicId).catch(err =>
          logger.warn('Background deletion failed:', { message: err.message })
        );
      }

      logger.info(`Profile image uploaded by admin: ${req.admin?.adminId} - ${result.public_id}`);

      return successResponse(res, 'Profile image uploaded successfully', {
        profileImage: profile.profileImage,
        ...(validation?.warnings?.length > 0 && { warnings: validation.warnings })
      });

    } catch (error) {
      await this._cleanupLocalFile(localFilePath);

      if (error.message === 'PROFILE_NOT_FOUND') {
        return errorResponse(res, 404, 'Profile not found', 'PROFILE_NOT_FOUND');
      }

      if (error.message.includes('Cloudinary upload failed')) {
        return errorResponse(res, 502, 'Failed to upload image to cloud storage', 'UPLOAD_FAILED');
      }

      logger.error('Upload profile image error:', { message: error.message, stack: error.stack });
      next(error);
    }
  }

async uploadResume(req, res, next) {
  const localFilePath = req.file?.path;
  let oldPublicId = null;

  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No resume file provided', 'NO_FILE');
    }

    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      await this._cleanupLocalFile(localFilePath);
      return errorResponse(res, 400, 'Only PDF, DOC, and DOCX files are allowed', 'INVALID_FILE_TYPE');
    }

    const validation = req.fileValidation?.[0];
    if (validation && !validation.valid) {
      await this._cleanupLocalFile(localFilePath);
      return errorResponse(res, 400, validation.error || 'File validation failed', 'VALIDATION_FAILED');
    }

    const profile = await this._getProfile();
    oldPublicId = profile.resume?.publicId;

    // Upload WITHOUT file extension in public_id
    const publicIdWithoutExt = `${profile.firstName}_${profile.lastName}_Resume`;
    
    const result = await this._uploadToCloudinaryWithRetry(localFilePath, {
      folder: 'portfolio/resume',
      resource_type: 'raw',
      public_id: publicIdWithoutExt,  // No .pdf extension
      invalidate: true,
      overwrite: true,
      type: 'upload'
    });

    // Generate signed URL (required for restricted raw files)
    const signedUrl = this._generateSignedUrl(result.public_id, {
      expiresIn: 31536000 // 1 year
    });

    logger.info('Resume uploaded with signed URL', {
      service: 'portfolio-api',
      publicId: result.public_id,
      originalUrl: result.secure_url,
      signedUrl: signedUrl,
      requestId: req.requestId
    });

  profile.resume = {
  url: result.secure_url,  // Uses clean URL: /upload/v.../file.pdf
  publicId: result.public_id,
  filename: req.file.originalname
};

    await profile.save();
    await this._cleanupLocalFile(localFilePath);

    if (oldPublicId && oldPublicId !== result.public_id) {
      // Clean old publicId (remove .pdf if present)
      const cleanOldPublicId = oldPublicId.replace(/\.pdf$/, '');
      this._safeCloudinaryDelete(cleanOldPublicId, {
        resource_type: 'raw',
        invalidate: true,
        requestId: req.requestId
      }).catch(err => logger.warn('Background deletion failed:', { message: err.message }));
    }

    logger.info(`Resume uploaded by admin: ${req.admin?.adminId} - ${result.public_id}`, {
      service: 'portfolio-api',
      requestId: req.requestId
    });

    return successResponse(res, 'Resume uploaded successfully', {
      resume: profile.resume,
      ...(validation?.warnings?.length > 0 && { warnings: validation.warnings })
    });
  } catch (error) {
    await this._cleanupLocalFile(localFilePath);

    if (error.message === 'PROFILE_NOT_FOUND') {
      return errorResponse(res, 404, 'Profile not found', 'PROFILE_NOT_FOUND');
    }

    if (error.message.includes('Cloudinary upload failed')) {
      return errorResponse(res, 502, 'Failed to upload resume to cloud storage', 'UPLOAD_FAILED');
    }

    logger.error('Upload resume error:', {
      message: error.message,
      stack: error.stack,
      requestId: req.requestId
    });
    next(error);
  }
}

// ADD this new method to refresh expired URLs
async refreshResumeUrl(req, res, next) {
  try {
    const profile = await this._getProfile();

    if (!profile.resume?.publicId) {
      return errorResponse(res, 404, 'No resume found', 'NO_RESUME');
    }

    const signedUrl = this._generateSignedUrl(profile.resume.publicId, {
      expiresIn: 31536000
    });

    profile.resume.url = signedUrl;
    await profile.save();

    logger.info('Resume URL refreshed', {
      service: 'portfolio-api',
      publicId: profile.resume.publicId,
      requestId: req.requestId
    });

    return successResponse(res, 'Resume URL refreshed successfully', {
      resume: profile.resume
    });
  } catch (error) {
    logger.error('Refresh resume URL error:', {
      message: error.message,
      stack: error.stack,
      requestId: req.requestId
    });
    next(error);
  }
}
  // ===========================
  // DELETE OPERATIONS
  // ===========================

  async deleteProfileImage(req, res, next) {
    try {
      const profile = await this._getProfile();

      if (!profile.profileImage?.publicId) {
        return errorResponse(res, 404, 'No profile image to delete', 'NO_IMAGE');
      }

      const publicId = profile.profileImage.publicId;

      profile.profileImage = {
        url: '',
        publicId: ''
      };

      await profile.save();

      await this._safeCloudinaryDelete(publicId);

      logger.info(`Profile image deleted by admin: ${req.admin?.adminId}`);

      return successResponse(res, 'Profile image deleted successfully');
    } catch (error) {
      if (error.message === 'PROFILE_NOT_FOUND') {
        return errorResponse(res, 404, 'Profile not found', 'PROFILE_NOT_FOUND');
      }
      
      logger.error('Delete profile image error:', { message: error.message, stack: error.stack });
      next(error);
    }
  }

  async deleteResume(req, res, next) {
    try {
      const profile = await this._getProfile();
      if (!profile.resume?.publicId) {
        return errorResponse(res, 404, 'No resume to delete', 'NO_RESUME');
      }
      const publicId = profile.resume.publicId;
      profile.resume = { url: '', publicId: '', filename: '' };
      await profile.save();
      await this._safeCloudinaryDelete(publicId, { 
        resource_type: 'raw', 
        invalidate: true, 
        requestId: req.requestId 
      });
      logger.info(`Resume deleted by admin: ${req.admin.adminId}`, { 
        service: 'portfolio-api', 
        requestId: req.requestId 
      });
      return successResponse(res, 'Resume deleted successfully');
    } catch (error) {
      logger.error('Delete resume error:', { 
        message: error.message, 
        stack: error.stack, 
        requestId: req.requestId 
      });
      if (error.message === 'PROFILE_NOT_FOUND') {
        return errorResponse(res, 404, 'Profile not found', 'PROFILE_NOT_FOUND');
      }
      next(error);
    }
  }
}

module.exports = new ProfileController();