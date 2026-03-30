// =====================================================
// controllers/UploadController.js
// Production-ready with critical security fixes
// =====================================================

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const { logger } = require('../utils/helpers');
const uploadConfig = require('../config/upload');

class UploadController {
  constructor() {
    // Bind all methods
    Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor')
      .forEach(method => {
        this[method] = this[method].bind(this);
      });

    // File metadata cache
    this.fileCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Initialize cleanup interval
    this.cleanupIntervalId = null;
    if (uploadConfig.tempFileCleanupInterval > 0) {
      this._startTempFileCleanup();
    }

    // Metrics tracking
    this.metrics = {
      uploads: 0,
      downloads: 0,
      deletes: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
      errors: 0
    };
  }

  // ===========================
  // SECURITY HELPERS
  // ===========================

  /**
   * Securely validate and resolve file path
   * CRITICAL: Prevents path traversal attacks
   */
  _validateAndResolvePath(filename, baseDir) {
    try {
      // Decode URL encoding
      const decoded = decodeURIComponent(filename);
      
      // Resolve to absolute path
      const fullPath = path.resolve(baseDir, decoded);
      const realBase = path.resolve(baseDir);
      
      // Ensure path is within base directory
      if (!fullPath.startsWith(realBase + path.sep) && fullPath !== realBase) {
        throw new Error('PATH_TRAVERSAL_DETECTED');
      }
      
      return fullPath;
    } catch (error) {
      if (error.message === 'PATH_TRAVERSAL_DETECTED') {
        throw error;
      }
      throw new Error('INVALID_PATH');
    }
  }

  /**
   * Validate filename security
   */
_validateFileSecurity(filename) {
  // Only check for directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    logger.warn(`Invalid filename detected: ${filename}`);
    return false;
  }
    
    // Check for valid characters
    const validFilenameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!validFilenameRegex.test(filename)) {
      return false;
    }
    
    // Prevent hidden files
    if (filename.startsWith('.')) {
      return false;
    }

    // Check length
    if (filename.length > 255) {
      return false;
    }
    
    return true;
  }

  /**
   * Enhanced file header validation
   * Detects file type spoofing and malicious files
   */
async _validateFileHeader(filePath, expectedMimeType) {
  try {
    const buffer = Buffer.alloc(64);
    const fd = await fs.open(filePath, 'r');
    await fd.read(buffer, 0, 64, 0);
    await fd.close();

    const hex = buffer.toString('hex').toUpperCase();
    logger.debug(`File header for ${filePath}: ${hex.slice(0, 16)}`, { mimetype: expectedMimeType });

    const signatures = {
      'image/jpeg': ['FFD8FFE0', 'FFD8FFE1', 'FFD8FFE2', 'FFD8FFE3', 'FFD8FFDB'],
      'image/png': ['89504E470D0A1A0A'],
      'image/gif': ['474946383761', '474946383961'],
      'image/webp': (h) => h.startsWith('52494646') && h.substring(16, 24) === '57454250',
      'application/pdf': ['255044462D', '25504446'], // Allow %PDF- and %PDF
      'application/zip': ['504B0304', '504B0506', '504B0708']
    };

    const dangerousSignatures = {
      'text/html': ['3C21444F', '3C68746D', '3C48544D'],
      'application/x-executable': ['4D5A'],
      'application/x-sh': ['23212F']
    };

    for (const [type, sigs] of Object.entries(dangerousSignatures)) {
      if (sigs.some(sig => hex.startsWith(sig))) {
        logger.warn(`Dangerous file detected: ${filePath} (${type})`);
        return false;
      }
    }

    const expectedSigs = signatures[expectedMimeType];
    if (!expectedSigs) {
      logger.warn(`No signature defined for MIME type: ${expectedMimeType}`);
      return true; // Allow unknown types to pass
    }

    if (typeof expectedSigs === 'function') {
      return expectedSigs(hex);
    }

    const isValid = expectedSigs.some(sig => hex.startsWith(sig));
    if (!isValid) {
      logger.warn(`Header validation failed for ${filePath}`, { expected: expectedSigs, actual: hex.slice(0, 16) });
    }
    return isValid;
  } catch (error) {
    logger.error('File header validation error:', {
      message: error.message,
      stack: error.stack,
      filePath,
      mimetype: expectedMimeType
    });
    return false;
  }
}

  // ===========================
  // HELPER METHODS
  // ===========================

  _successResponse(res, message, data = null, statusCode = 200) {
    const response = { success: true, message };
    if (data) response.data = data;
    return res.status(statusCode).json(response);
  }

  _errorResponse(res, statusCode, message, code, additionalData = {}) {
    return res.status(statusCode).json({
      success: false,
      message,
      code,
      ...additionalData
    });
  }

  /**
   * Get cached file metadata
   */
  async _getCachedFileMetadata(filePath) {
    const cached = this.fileCache.get(filePath);
    
    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      return cached.data;
    }
    
    const metadata = await this._getFileMetadata(filePath);
    
    if (metadata) {
      this.fileCache.set(filePath, {
        data: metadata,
        timestamp: Date.now()
      });
    }
    
    return metadata;
  }

  async _getFileMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: ext,
        isImage: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext),
        isDocument: ['.pdf', '.doc', '.docx', '.txt'].includes(ext)
      };
    } catch (error) {
      return null;
    }
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async _cleanupFile(filePath) {
    if (!filePath) return;
    
    try {
      await fs.unlink(filePath);
      logger.info(`Cleaned up file: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup file: ${filePath}`, error.message);
    }
  }

  /**
   * Calculate file checksum (async, optional)
   */
  async _calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fsSync.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // ===========================
  // TEMP FILE CLEANUP
  // ===========================

  _startTempFileCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    
    this.cleanupIntervalId = setInterval(async () => {
      try {
        await this._performTempCleanup();
      } catch (error) {
        logger.error('Temp file cleanup error:', error);
      }
    }, uploadConfig.tempFileCleanupInterval);

    logger.info('Temp file cleanup interval started');
  }

  async _performTempCleanup() {
    const tempDir = uploadConfig.tempDir || path.join(__dirname, '..', 'temp');
    
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          logger.warn(`Error cleaning temp file ${file}:`, error.message);
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} temp file(s)`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Temp cleanup error:', error);
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      logger.info('Upload controller destroyed');
    }
  }

  // ===========================
  // UPLOAD METHODS
  // ===========================

async uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return this._errorResponse(res, 400, 'No file uploaded', 'NO_FILE_UPLOADED');
    }

    // Security validation
    if (!this._validateFileSecurity(req.file.filename)) {
      await this._cleanupFile(req.file.path);
      return this._errorResponse(res, 400, 'Invalid filename format', 'INVALID_FILENAME');
    }

    // Validate file header
    if (uploadConfig.headerValidationEnabled) {
      const isValidHeader = await this._validateFileHeader(req.file.path, req.file.mimetype);
      if (!isValidHeader) {
        await this._cleanupFile(req.file.path);
        return this._errorResponse(
          res, 
          400, 
          'File type mismatch. The file content does not match its extension.', 
          'FILE_TYPE_MISMATCH'
        );
      }
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
      sizeFormatted: this._formatFileSize(req.file.size),
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    // Calculate checksum in background (non-blocking)
    if (uploadConfig.calculateChecksum) {
      this._calculateChecksum(req.file.path)
        .then(checksum => fileData.checksum = checksum)
        .catch(err => logger.warn('Checksum calculation failed:', { message: err.message, stack: err.stack }));
    }

    this.metrics.uploads++;
    this.metrics.totalBytesUploaded += req.file.size;

    logger.info(`File uploaded: ${req.file.originalname} (${this._formatFileSize(req.file.size)}) by ${req.admin?.username || req.ip}`);

    return this._successResponse(res, 'File uploaded successfully', { file: fileData }, 201);
  } catch (error) {
    this.metrics.errors++;
    logger.error('Upload file error:', {
      message: error.message,
      stack: error.stack,
      file: req.file?.originalname,
      path: req.file?.path,
      mimetype: req.file?.mimetype
    });
    if (req.file?.path) {
      await this._cleanupFile(req.file.path);
    }
    return this._errorResponse(res, 500, 'Upload failed', 'UPLOAD_SERVER_ERROR', { details: error.message });
  }
}

  // ===========================
  // FILE SERVING (SECURE)
  // ===========================

  async serveFile(req, res, next) {
    try {
      const { filename } = req.params;

      // Security validation
      if (!this._validateFileSecurity(filename)) {
        logger.warn(`Invalid filename attempt: ${filename} from IP ${req.ip}`);
        return this._errorResponse(res, 400, 'Invalid filename format', 'INVALID_FILENAME');
      }

      // Secure path resolution
      let filePath;
      try {
        filePath = this._validateAndResolvePath(filename, uploadConfig.uploadDir);
      } catch (error) {
        if (error.message === 'PATH_TRAVERSAL_DETECTED') {
          logger.warn(`Path traversal attempt: ${filename} from IP ${req.ip}`);
          return this._errorResponse(res, 403, 'Access denied', 'FORBIDDEN');
        }
        return this._errorResponse(res, 400, 'Invalid path', 'INVALID_PATH');
      }

      // Get metadata using file descriptor (TOCTOU protection)
      let fileHandle;
      try {
        fileHandle = await fs.open(filePath, 'r');
        const stats = await fileHandle.stat();
        await fileHandle.close();

        // Enhanced security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'");
        res.setHeader('Referrer-Policy', 'no-referrer');
        
        // Force download for potentially dangerous files
        const ext = path.extname(filename).toLowerCase();
        const dangerousExts = ['.html', '.htm', '.xml', '.svg', '.js', '.pdf'];
        
        if (dangerousExts.includes(ext)) {
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
          res.setHeader('X-Download-Options', 'noopen');
        }
        
        // Set content headers
        res.setHeader('Content-Type', this._getMimeType(filename));
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`);
        res.setHeader('Last-Modified', stats.mtime.toUTCString());
        
        // Handle conditional requests
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];
        
        if (ifNoneMatch === `"${stats.mtime.getTime()}-${stats.size}"` ||
            (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)) {
          return res.status(304).end();
        }

        // Log access for security auditing
        logger.info('File accessed', {
          filename,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          size: stats.size
        });

        this.metrics.downloads++;
        this.metrics.totalBytesDownloaded += stats.size;

        // Handle range requests
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
          const chunkSize = (end - start) + 1;

          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', chunkSize);

          const stream = fsSync.createReadStream(filePath, { start, end });
          stream.on('error', (error) => {
            logger.error('Range stream error:', error);
            if (!res.headersSent) res.status(500).end();
          });
          return stream.pipe(res);
        }

        // Stream the file
        const fileStream = fsSync.createReadStream(filePath);
        
        fileStream.on('error', (error) => {
          logger.error('File stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Error streaming file',
              code: 'FILE_STREAM_ERROR'
            });
          }
        });

        fileStream.pipe(res);
      } catch (error) {
        if (fileHandle) await fileHandle.close().catch(() => {});
        throw error;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this._errorResponse(res, 404, 'File not found', 'FILE_NOT_FOUND');
      }
      logger.error('Serve file error:', error);
      next(error);
    }
  }

  // ===========================
  // FILE MANAGEMENT
  // ===========================

  async deleteFile(req, res, next) {
    try {
      const { filename } = req.params;

      if (!this._validateFileSecurity(filename)) {
        return this._errorResponse(res, 400, 'Invalid filename format', 'INVALID_FILENAME');
      }

      // Secure path resolution
      let filePath;
      try {
        filePath = this._validateAndResolvePath(filename, uploadConfig.uploadDir);
      } catch (error) {
        if (error.message === 'PATH_TRAVERSAL_DETECTED') {
          logger.warn(`Path traversal attempt in delete: ${filename}`);
          return this._errorResponse(res, 403, 'Access denied', 'FORBIDDEN');
        }
        return this._errorResponse(res, 400, 'Invalid path', 'INVALID_PATH');
      }

      // TOCTOU protection using file descriptor
      let fileHandle;
      try {
        fileHandle = await fs.open(filePath, 'r');
        const stats = await fileHandle.stat();
        await fileHandle.close();
        
        // Now delete
        await fs.unlink(filePath);
        
        this.metrics.deletes++;
        logger.info(`File deleted: ${filename} (${this._formatFileSize(stats.size)})`);

        return this._successResponse(res, 'File deleted successfully', {
          filename,
          deletedAt: new Date().toISOString()
        });
      } finally {
        if (fileHandle) await fileHandle.close().catch(() => {});
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this._errorResponse(res, 404, 'File not found', 'FILE_NOT_FOUND');
      }
      this.metrics.errors++;
      logger.error('Delete file error:', error);
      next(error);
    }
  }

  async getFilesList(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        type, 
        search,
        sortBy = 'modified',
        sortOrder = 'desc'
      } = req.query;
      
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

      const allFiles = await fs.readdir(uploadConfig.uploadDir);
      
      // Parallel metadata fetching with caching
      const filePromises = allFiles
        .filter(filename => this._validateFileSecurity(filename))
        .map(async (filename) => {
          const filePath = path.join(uploadConfig.uploadDir, filename);
          const metadata = await this._getCachedFileMetadata(filePath);
          
          if (!metadata) return null;
          
          return {
            filename,
            path: `/uploads/${filename}`,
            size: metadata.size,
            sizeFormatted: this._formatFileSize(metadata.size),
            extension: metadata.extension,
            isImage: metadata.isImage,
            isDocument: metadata.isDocument,
            created: metadata.created,
            modified: metadata.modified
          };
        });

      let filesData = (await Promise.all(filePromises)).filter(Boolean);

      // Apply filters
      if (type === 'images') {
        filesData = filesData.filter(f => f.isImage);
      } else if (type === 'documents') {
        filesData = filesData.filter(f => f.isDocument);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filesData = filesData.filter(f => f.filename.toLowerCase().includes(searchLower));
      }

      // Sort
      filesData.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortBy === 'size') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        if (sortBy === 'created' || sortBy === 'modified') {
          const aTime = new Date(aVal).getTime();
          const bTime = new Date(bVal).getTime();
          return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
        }
        
        const comp = String(aVal).localeCompare(String(bVal));
        return sortOrder === 'asc' ? comp : -comp;
      });

      // Paginate
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedFiles = filesData.slice(startIndex, startIndex + limitNum);
      const totalSize = filesData.reduce((sum, f) => sum + f.size, 0);

      return this._successResponse(res, 'Files list retrieved successfully', {
        files: paginatedFiles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filesData.length,
          pages: Math.ceil(filesData.length / limitNum)
        },
        summary: {
          totalFiles: filesData.length,
          totalSize,
          totalSizeFormatted: this._formatFileSize(totalSize),
          imageFiles: filesData.filter(f => f.isImage).length,
          documentFiles: filesData.filter(f => f.isDocument).length
        }
      });
    } catch (error) {
      logger.error('Get files list error:', error);
      next(error);
    }
  }

  async getMetrics(req, res, next) {
    try {
      return this._successResponse(res, 'Metrics retrieved', {
        ...this.metrics,
        cacheSize: this.fileCache.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  async getStorageStats(req, res, next) {
    try {
      const files = await fs.readdir(uploadConfig.uploadDir);
      let totalSize = 0;
      let imageCount = 0;
      let documentCount = 0;

      for (const filename of files) {
        if (!this._validateFileSecurity(filename)) continue;
        
        const filePath = path.join(uploadConfig.uploadDir, filename);
        const metadata = await this._getCachedFileMetadata(filePath);
        
        if (metadata) {
          totalSize += metadata.size;
          if (metadata.isImage) imageCount++;
          if (metadata.isDocument) documentCount++;
        }
      }

      const stats = {
        totalFiles: files.length,
        totalSize,
        totalSizeFormatted: this._formatFileSize(totalSize),
        imageFiles: imageCount,
        documentFiles: documentCount,
        otherFiles: files.length - imageCount - documentCount,
        uploadDirectory: uploadConfig.uploadDir,
        maxFileSize: uploadConfig.maxFileSize,
        maxFileSizeFormatted: this._formatFileSize(uploadConfig.maxFileSize)
      };

      return this._successResponse(res, 'Storage statistics retrieved', stats);
    } catch (error) {
      logger.error('Get storage stats error:', error);
      next(error);
    }
  }
}

// Export singleton and cleanup handler
const controller = new UploadController();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  controller.destroy();
});

process.on('SIGINT', () => {
  controller.destroy();
});

module.exports = controller;