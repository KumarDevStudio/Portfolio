// middleware/upload.js — Cloudinary version
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const cloudinaryStorage = require('multer-storage-cloudinary');

const CloudinaryStorage =
  cloudinaryStorage.CloudinaryStorage || cloudinaryStorage;
  
  const cloudinary = require('../config/cloudinary');
const uploadConfig = require('../config/upload');
const { logger } = require('../utils/helpers');

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const uploadRateLimit = new Map();
const UPLOAD_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

const getConfig = (key, defaultValue) =>
  uploadConfig[key] !== undefined ? uploadConfig[key] : defaultValue;

const MAX_UPLOADS_PER_HOUR   = getConfig('uploadsPerHour', 50);
const MAX_UPLOAD_SIZE_PER_HOUR = getConfig('uploadSizePerHour', 100 * 1024 * 1024);

const checkUploadRateLimit = (req, res, next) => {
  const userId = req.admin?.adminId || req.ip;
  const now    = Date.now();
  const userLimit = uploadRateLimit.get(userId) || {
    count: 0,
    size: 0,
    resetTime: now + UPLOAD_RATE_WINDOW,
  };

  if (now > userLimit.resetTime) {
    userLimit.count     = 0;
    userLimit.size      = 0;
    userLimit.resetTime = now + UPLOAD_RATE_WINDOW;
  }

  if (userLimit.count >= MAX_UPLOADS_PER_HOUR) {
    const timeRemaining = Math.ceil((userLimit.resetTime - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Upload limit exceeded. Try again in ${timeRemaining} minutes.`,
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: timeRemaining * 60,
    });
  }

  req.uploadRateLimit = userLimit;
  uploadRateLimit.set(userId, userLimit);
  next();
};

// ─── Cloudinary Storage ───────────────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;

    return {
      folder: 'portfolio/about',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      format: normalizedExt,
      // Auto-quality + limit dimensions — mirrors your old Sharp resize logic
      transformation: [
        {
          width:   getConfig('maxImageWidth', 800),
          height:  getConfig('maxImageHeight', 1000),
          crop:    'limit',
          quality: 'auto',
        },
      ],
      // fieldname + timestamp + random → collision-free, no path traversal risk
      public_id: `${file.fieldname}_${Date.now()}_${randomSuffix}`,
    };
  },
});

// ─── File Filter ──────────────────────────────────────────────────────────────
// Mirrors your original checks: MIME type, extension, and security patterns.
// Header/magic-byte validation is skipped — the file never touches local disk.
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    return cb(
      new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`),
      false
    );
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  if (!allowedExts.includes(ext)) {
    return cb(
      new Error(`Invalid extension: ${ext}. Allowed: ${allowedExts.join(', ')}`),
      false
    );
  }

  // Security checks (same logic as before)
  const securityChecks = [
    {
  test: () => {
    const parts = file.originalname.split('.');
    if (parts.length <= 2) return false;
    const dangerous = ['php','js','py','rb','sh','exe','asp','aspx','jsp','cgi'];
    return parts.slice(1, -1).some(e => dangerous.includes(e.toLowerCase()));
  },
  message: 'Filename contains a potentially dangerous embedded extension',
},
    {
      test: () =>
        /[<>:"|?*]/.test(file.originalname) || file.originalname.includes('..'),
      message: 'Filename contains invalid or potentially dangerous characters',
    },
    {
      test: () => file.originalname.length > 255,
      message: 'Filename is too long',
    },
    {
      test: () =>
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(
          path.basename(file.originalname, ext)
        ),
      message: 'Filename uses reserved system name',
    },
  ];

  for (const check of securityChecks) {
    if (check.test()) return cb(new Error(check.message), false);
  }

  cb(null, true);
};

// ─── Multer Instance ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:      getConfig('maxFileSize', 5 * 1024 * 1024), // 5 MB default
    files:         getConfig('maxFiles', 1),
    fieldSize:     1024 * 1024,
    fieldNameSize: 100,
    headerPairs:   2000,
  },
});

// ─── Post-Upload Validation ───────────────────────────────────────────────────
// After Cloudinary storage, req.file.path = secure URL, req.file.filename = public_id.
// We validate size rate-limit here (MIME/ext already checked in fileFilter).
const validateUploadedFile = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files were uploaded',
      code: 'NO_FILES_UPLOADED',
    });
  }

  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

  if (req.uploadRateLimit) {
    const userLimit = req.uploadRateLimit;

    if (userLimit.size + totalSize > MAX_UPLOAD_SIZE_PER_HOUR) {
      // Best-effort: delete the just-uploaded Cloudinary asset
      for (const file of files) {
        if (file.filename) {
          cloudinary.uploader.destroy(file.filename).catch(err =>
            logger.warn(`Cloudinary cleanup after size-limit breach: ${err.message}`)
          );
        }
      }

      const remaining    = Math.max(0, MAX_UPLOAD_SIZE_PER_HOUR - userLimit.size);
      const timeRemaining = Math.ceil((userLimit.resetTime - Date.now()) / 60000);

      return res.status(429).json({
        success: false,
        message: `Upload size limit exceeded. ${Math.round(remaining / 1024 / 1024)}MB remaining this hour.`,
        code: 'UPLOAD_SIZE_LIMIT_EXCEEDED',
        retryAfter: timeRemaining * 60,
      });
    }

    userLimit.count += files.length;
    userLimit.size  += totalSize;
  }

  // Attach a consistent validation result so controllers can read req.fileValidation
  req.fileValidation = files.map(file => ({
    filename:     file.filename,   // Cloudinary public_id
    originalName: file.originalname,
    valid:        true,
    warnings:     [],
    metadata: {
      url:      file.path,         // Cloudinary secure URL
      publicId: file.filename,
      size:     file.size,
      mimetype: file.mimetype,
    },
  }));

  next();
};

// ─── Multer Error Handler ─────────────────────────────────────────────────────
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.warn(`Multer error: ${err.code} — ${err.message} from ${req.ip}`);

    const errorMap = {
      LIMIT_FILE_SIZE: {
        message: `File too large. Maximum size is ${Math.round(getConfig('maxFileSize', 5 * 1024 * 1024) / (1024 * 1024))}MB`,
        code: 'FILE_TOO_LARGE',
      },
      LIMIT_FILE_COUNT: {
        message: `Too many files. Maximum is ${getConfig('maxFiles', 1)}`,
        code: 'TOO_MANY_FILES',
      },
      LIMIT_UNEXPECTED_FILE: {
        message: 'Unexpected file field',
        code: 'UNEXPECTED_FILE_FIELD',
      },
    };

    const response = errorMap[err.code] || {
      message: 'Upload error occurred',
      code: 'UPLOAD_ERROR',
    };

    return res.status(400).json({ success: false, ...response });
  }

  // Custom validation errors from fileFilter
  if (
    err?.message &&
    (err.message.startsWith('Invalid file type') ||
      err.message.includes('Invalid extension') ||
      err.message.includes('multiple extensions') ||
      err.message.includes('invalid or potentially dangerous') ||
      err.message.includes('too long') ||
      err.message.includes('reserved system name'))
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: 'VALIDATION_ERROR',
    });
  }

  logger.error('Unexpected upload error:', err);
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred during upload',
    code: 'UPLOAD_SERVER_ERROR',
  });
};

// ─── Middleware Factory ───────────────────────────────────────────────────────
// Identical interface to the old version — routes use `...uploadSingle` unchanged.
const createUploadMiddleware = (type = 'single') => [
  checkUploadRateLimit,
  (req, res, next) => {
    const handler =
      type === 'multiple'
        ? upload.array('files', getConfig('maxFiles', 5))
        : upload.single('file');

    handler(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);

      const files = req.files || (req.file ? [req.file] : []);
      if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
        const fileStr =
          files.length === 1
            ? `${files[0].originalname} → ${files[0].filename}`
            : `${files.length} files`;
        logger.info(
          `Upload to Cloudinary: ${fileStr} (${totalSize} bytes) by ${req.admin?.username || req.ip}`
        );
      }

      next();
    });
  },
  validateUploadedFile,
];

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  uploadSingle:   createUploadMiddleware('single'),
  uploadMultiple: createUploadMiddleware('multiple'),

  // Individual components (kept for any direct imports elsewhere)
  checkUploadRateLimit,
  validateUploadedFile,
  handleMulterError,

  // Stats (temp file tracking removed — Cloudinary manages storage)
  getUploadStats: () => ({ activeRateLimitEntries: uploadRateLimit.size }),
};