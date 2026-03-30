

const path = require('path');
const fs = require('fs');

// Helper function to parse size strings (e.g., "10MB" -> bytes)
const parseSize = (sizeStr) => {
  if (typeof sizeStr === 'number') return sizeStr;
  
  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024
  };

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) return parseInt(sizeStr) || 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return Math.floor(value * units[unit]);
};

// Parse boolean environment variables
const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  return value.toLowerCase() === 'true' || value === '1';
};

// ===========================
// CONFIGURATION
// ===========================

const uploadConfig = {
  // Directory configuration
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  tempDir: process.env.TEMP_DIR || path.join(__dirname, '..', 'temp'),
  
  // File size limits
  maxFileSize: parseSize(process.env.MAX_FILE_SIZE || '10MB'),
  maxFiles: parseInt(process.env.MAX_FILES) || 10,
  
  // Image-specific settings
  maxImageWidth: parseInt(process.env.MAX_IMAGE_WIDTH) || 4000,
  maxImageHeight: parseInt(process.env.MAX_IMAGE_HEIGHT) || 4000,
  minImageWidth: parseInt(process.env.MIN_IMAGE_WIDTH) || 1,
  minImageHeight: parseInt(process.env.MIN_IMAGE_HEIGHT) || 1,
  imageQuality: Math.max(1, Math.min(100, parseInt(process.env.IMAGE_QUALITY) || 85)),
  autoResize: parseBoolean(process.env.AUTO_RESIZE),
  
  // Allowed file types (MIME types)
  allowedTypes: [
    // Images
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    
    // Additional types from environment
    ...(process.env.ADDITIONAL_MIME_TYPES 
      ? process.env.ADDITIONAL_MIME_TYPES.split(',').map(t => t.trim()) 
      : [])
  ],
  
  // Allowed extensions (additional security layer)
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.txt',
    ...(process.env.ADDITIONAL_EXTENSIONS 
      ? process.env.ADDITIONAL_EXTENSIONS.split(',').map(e => e.trim()) 
      : [])
  ],
  
  // Security settings
  virusScanEnabled: parseBoolean(process.env.VIRUS_SCAN_ENABLED),
  headerValidationEnabled: parseBoolean(process.env.HEADER_VALIDATION_ENABLED, true),
  validateFileContent: parseBoolean(process.env.VALIDATE_FILE_CONTENT, true),
  
  // Rate limiting
  uploadsPerHour: parseInt(process.env.UPLOADS_PER_HOUR) || 50,
  uploadSizePerHour: parseSize(process.env.UPLOAD_SIZE_PER_HOUR || '100MB'),
  
  // Cleanup settings
  tempFileCleanupInterval: parseInt(process.env.TEMP_CLEANUP_INTERVAL) || 30 * 60 * 1000, // 30 minutes
  tempFileMaxAge: parseInt(process.env.TEMP_FILE_MAX_AGE) || 60 * 60 * 1000, // 1 hour
  deleteFailedUploads: parseBoolean(process.env.DELETE_FAILED_UPLOADS, true),
  
  // Image processing
  generateThumbnails: parseBoolean(process.env.GENERATE_THUMBNAILS),
  thumbnailSizes: (process.env.THUMBNAIL_SIZES || '150x150,300x300')
    .split(',')
    .map(size => {
      const [width, height] = size.split('x').map(Number);
      return { width, height };
    }),
  
  // CDN/Storage settings
  useCloudStorage: parseBoolean(process.env.USE_CLOUD_STORAGE),
  cloudStorageProvider: process.env.CLOUD_STORAGE_PROVIDER || 'local', // 'aws', 'gcp', 'azure', 'cloudinary'
  
  // File naming
  preserveOriginalName: parseBoolean(process.env.PRESERVE_ORIGINAL_NAME),
  fileNamingStrategy: process.env.FILE_NAMING_STRATEGY || 'timestamp-random', // 'uuid', 'timestamp-random', 'hash'
  
  // Compression settings
  enableCompression: parseBoolean(process.env.ENABLE_FILE_COMPRESSION, true),
  compressionQuality: Math.max(1, Math.min(100, parseInt(process.env.COMPRESSION_QUALITY) || 85)),
  
  // Metadata
  storeMetadata: parseBoolean(process.env.STORE_FILE_METADATA, true),
  generateChecksums: parseBoolean(process.env.GENERATE_CHECKSUMS, true),
  
  // Logging
  logUploads: parseBoolean(process.env.LOG_UPLOADS, true),
  logDeletions: parseBoolean(process.env.LOG_DELETIONS, true),
  
  // Feature flags
  enableBatchOperations: parseBoolean(process.env.ENABLE_BATCH_OPERATIONS, true),
  enableImageOptimization: parseBoolean(process.env.ENABLE_IMAGE_OPTIMIZATION, true),
};

// ===========================
// VALIDATION
// ===========================

const validateConfig = () => {
  const errors = [];
  const warnings = [];

  // Validate directories
  if (!uploadConfig.uploadDir) {
    errors.push('Upload directory must be specified');
  }

  // Validate file size limits
  if (uploadConfig.maxFileSize < 1024) {
    warnings.push('Maximum file size is very small (< 1KB)');
  }

  if (uploadConfig.maxFileSize > 100 * 1024 * 1024) { // 100MB
    warnings.push('Maximum file size is very large (> 100MB). This may cause performance issues.');
  }

  // Validate max files
  if (uploadConfig.maxFiles < 1) {
    errors.push('Maximum files must be at least 1');
  }

  if (uploadConfig.maxFiles > 100) {
    warnings.push('Maximum files is very high (> 100). This may cause memory issues.');
  }

  // Validate allowed types
  if (!uploadConfig.allowedTypes || uploadConfig.allowedTypes.length === 0) {
    errors.push('At least one file type must be allowed');
  }

  // Validate image dimensions
  if (uploadConfig.maxImageWidth < uploadConfig.minImageWidth) {
    errors.push('Maximum image width must be greater than minimum width');
  }

  if (uploadConfig.maxImageHeight < uploadConfig.minImageHeight) {
    errors.push('Maximum image height must be greater than minimum height');
  }

  // Validate quality settings
  if (uploadConfig.imageQuality < 1 || uploadConfig.imageQuality > 100) {
    errors.push('Image quality must be between 1 and 100');
  }

  // Validate rate limits
  if (uploadConfig.uploadsPerHour < 1) {
    warnings.push('Uploads per hour is very restrictive (< 1)');
  }

  // Validate cleanup interval
  if (uploadConfig.tempFileCleanupInterval < 60000) { // 1 minute
    warnings.push('Temp cleanup interval is very frequent (< 1 minute)');
  }

  return { errors, warnings };
};

// ===========================
// INITIALIZATION
// ===========================

const initializeUploadConfig = () => {
  const { errors, warnings } = validateConfig();

  // Log errors and warnings
  if (errors.length > 0) {
    console.error('❌ Upload configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Invalid upload configuration');
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Upload configuration warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // Create directories if they don't exist
  const createDir = (dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
      }
    } catch (error) {
      console.error(`✗ Failed to create directory ${dir}:`, error.message);
      throw error;
    }
  };

  createDir(uploadConfig.uploadDir);
  if (uploadConfig.tempDir) {
    createDir(uploadConfig.tempDir);
  }

  console.log('✓ Upload configuration initialized successfully');
  console.log(`  - Upload directory: ${uploadConfig.uploadDir}`);
  console.log(`  - Max file size: ${Math.round(uploadConfig.maxFileSize / (1024 * 1024))}MB`);
  console.log(`  - Max files per upload: ${uploadConfig.maxFiles}`);
  console.log(`  - Allowed types: ${uploadConfig.allowedTypes.length} types`);
  console.log(`  - Rate limit: ${uploadConfig.uploadsPerHour} uploads/hour`);
};

// ===========================
// UTILITY FUNCTIONS
// ===========================

const getStorageInfo = () => {
  try {
    const stats = fs.statSync(uploadConfig.uploadDir);
    return {
      directory: uploadConfig.uploadDir,
      exists: true,
      writable: fs.accessSync ? (() => {
        try {
          fs.accessSync(uploadConfig.uploadDir, fs.constants.W_OK);
          return true;
        } catch {
          return false;
        }
      })() : true
    };
  } catch (error) {
    return {
      directory: uploadConfig.uploadDir,
      exists: false,
      writable: false,
      error: error.message
    };
  }
};

const isValidFileType = (mimetype, extension) => {
  return (
    uploadConfig.allowedTypes.includes(mimetype) &&
    uploadConfig.allowedExtensions.includes(extension.toLowerCase())
  );
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ===========================
// EXPORTS
// ===========================

module.exports = uploadConfig;
module.exports.initializeUploadConfig = initializeUploadConfig;
module.exports.validateConfig = validateConfig;
module.exports.getStorageInfo = getStorageInfo;
module.exports.isValidFileType = isValidFileType;
module.exports.formatSize = formatSize;
module.exports.parseSize = parseSize;