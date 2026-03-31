'use strict';

// ============================================================
// middleware/upload.js — Cloudinary upload middleware (v3)
// ============================================================
// New in v3: field schema system
//   Each upload field declares its own rules inline — folder,
//   allowed types, size cap, dimensions, max count, and whether
//   the field is required. One middleware call handles any
//   combination of avatar / cover / gallery in a single route.
//
// Quick-start:
//
//   const { uploadFields } = require('../middleware/upload');
//
//   const profileUpload = uploadFields({
//     avatar: {
//       maxCount:     1,
//       maxSizeBytes: 2 * 1024 * 1024,
//       folder:       'portfolio/avatars',
//       allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
//       transform:    [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
//       required:     true,
//     },
//     cover: {
//       maxCount:     1,
//       maxSizeBytes: 5 * 1024 * 1024,
//       folder:       'portfolio/covers',
//       allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
//       transform:    [{ width: 1920, height: 600, crop: 'fill', quality: 'auto' }],
//     },
//     gallery: {
//       maxCount:     8,
//       maxSizeBytes: 8 * 1024 * 1024,
//       folder:       'portfolio/gallery',
//       allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
//       transform:    [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
//     },
//   });
//
//   router.post('/profile', authenticate, ...profileUpload, controller.update);
//
// After middleware, controllers read req.uploadedFiles:
//   {
//     avatar:  [{ fieldname, publicId, url, originalName, size, mimetype }],
//     cover:   [{ ... }],
//     gallery: [{ ... }, { ... }],
//   }
//
// v2 exports (uploadSingle, uploadMultiple) are unchanged.
// ============================================================

const multer               = require('multer');
const path                 = require('path');
const crypto               = require('crypto');
const cloudinaryStoragePkg = require('multer-storage-cloudinary');
const cloudinary           = require('../config/cloudinary');
const uploadConfig         = require('../config/upload');
const { logger }           = require('../utils/helpers');

// ===========================
// CLOUDINARY STORAGE IMPORT
// ===========================
const CloudinaryStorage =
  cloudinaryStoragePkg.CloudinaryStorage || cloudinaryStoragePkg;

// ===========================
// GLOBAL CONFIG
// ===========================
const getConfig = (key, defaultValue) =>
  uploadConfig[key] !== undefined ? uploadConfig[key] : defaultValue;

const GLOBAL_MAX_FILE_SIZE    = getConfig('maxFileSize',       5  * 1024 * 1024);
const GLOBAL_MAX_FILES        = getConfig('maxFiles',          1);
const GLOBAL_MAX_IMAGE_WIDTH  = getConfig('maxImageWidth',     800);
const GLOBAL_MAX_IMAGE_HEIGHT = getConfig('maxImageHeight',    1000);
const UPLOADS_PER_HOUR        = getConfig('uploadsPerHour',    50);
const UPLOAD_SIZE_PER_HOUR    = getConfig('uploadSizePerHour', 100 * 1024 * 1024);
const UPLOAD_RATE_WINDOW      = 60 * 60 * 1000;
const FIELD_SIZE_LIMIT        = parseInt(process.env.JSON_LIMIT, 10) || 5 * 1024 * 1024;

// ===========================
// SECURITY CONSTANTS
// ===========================
const DANGEROUS_EMBEDDED_EXTS = new Set([
  'php','js','py','rb','sh','exe','asp','aspx','jsp','cgi','pl','ps1','bat','cmd',
]);
const RESERVED_NAMES = new Set([
  'con','prn','aux','nul',
  'com1','com2','com3','com4','com5','com6','com7','com8','com9',
  'lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9',
]);

// Global fallback sets used by v2 single/multiple API
const DEFAULT_ALLOWED_MIMES = new Set([
  'image/jpeg','image/jpg','image/png','image/webp','image/gif',
]);
const DEFAULT_ALLOWED_EXTS = new Set([
  '.jpg','.jpeg','.png','.webp','.gif',
]);

// ===========================
// RATE LIMIT STORE
// ===========================
const uploadRateLimit = new Map();

const pruneRateLimitStore = () => {
  const now = Date.now();
  for (const [key, entry] of uploadRateLimit.entries()) {
    if (now > entry.resetTime) uploadRateLimit.delete(key);
  }
};

const pruneTimer = setInterval(pruneRateLimitStore, UPLOAD_RATE_WINDOW);
if (pruneTimer.unref) pruneTimer.unref();

const getRateLimitKey = (req) => req.admin?.id ?? req.ip;

const checkUploadRateLimit = (req, res, next) => {
  const key = getRateLimitKey(req);
  const now = Date.now();
  let entry = uploadRateLimit.get(key);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, size: 0, resetTime: now + UPLOAD_RATE_WINDOW };
    uploadRateLimit.set(key, entry);
  }

  if (entry.count >= UPLOADS_PER_HOUR) {
    const minutesLeft = Math.ceil((entry.resetTime - now) / 60_000);
    return res.status(429).json({
      success:    false,
      message:    `Upload limit exceeded. Try again in ${minutesLeft} minutes.`,
      code:       'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: minutesLeft * 60,
    });
  }

  req._rateLimitEntry = entry;
  next();
};

// ===========================
// FIELD SCHEMA NORMALISER
// ===========================
/**
 * @typedef {Object} FieldSchema
 * @property {number}   [maxCount=1]
 * @property {number}   [maxSizeBytes]        Per-file cap. Defaults to GLOBAL_MAX_FILE_SIZE.
 * @property {string}   [folder]              Cloudinary folder. Defaults to 'portfolio/uploads'.
 * @property {string[]} [allowedMimes]        MIME whitelist. Defaults to all image types.
 * @property {Object[]} [transform]           Cloudinary transformation array.
 * @property {boolean}  [required=false]      Whether ≥1 file is mandatory for this field.
 */

// Maps MIME types → valid file extensions
const MIME_TO_EXT = {
  'image/jpeg':    ['.jpg', '.jpeg'],
  'image/jpg':     ['.jpg', '.jpeg'],
  'image/png':     ['.png'],
  'image/webp':    ['.webp'],
  'image/gif':     ['.gif'],
  'image/svg+xml': ['.svg'],
};

const normaliseFieldSchema = (fieldname, schema) => {
  if (!schema || typeof schema !== 'object') {
    throw new Error(`[upload.js] Invalid schema for field "${fieldname}"`);
  }

  const allowedMimes = schema.allowedMimes
    ? new Set(schema.allowedMimes)
    : DEFAULT_ALLOWED_MIMES;

  const allowedExts = new Set(
    [...allowedMimes].flatMap((m) => MIME_TO_EXT[m] ?? [])
  );

  return {
    maxCount:     schema.maxCount     ?? 1,
    maxSizeBytes: schema.maxSizeBytes ?? GLOBAL_MAX_FILE_SIZE,
    folder:       schema.folder       ?? 'portfolio/uploads',
    allowedMimes,
    allowedExts,
    transform:    schema.transform ?? [
      { width: GLOBAL_MAX_IMAGE_WIDTH, height: GLOBAL_MAX_IMAGE_HEIGHT, crop: 'limit', quality: 'auto' },
    ],
    required: schema.required ?? false,
  };
};

// ===========================
// SHARED SECURITY CHECKS
// ===========================
// Returns an error string on failure, null on success.
// Used by both v2 and v3 file filters.
const runSecurityChecks = (file, allowedMimes, allowedExts) => {
  const ext      = path.extname(file.originalname).toLowerCase();
  const basename = path.basename(file.originalname, ext).toLowerCase();
  const parts    = file.originalname.split('.');

  if (!allowedMimes.has(file.mimetype)) {
    return `Invalid file type: ${file.mimetype}. Allowed: ${[...allowedMimes].join(', ')}`;
  }
  if (!allowedExts.has(ext)) {
    return `Invalid extension: ${ext}. Allowed: ${[...allowedExts].join(', ')}`;
  }
  if (parts.length > 2) {
    const embedded = parts.slice(1, -1).map((p) => p.toLowerCase());
    if (embedded.some((e) => DANGEROUS_EMBEDDED_EXTS.has(e))) {
      return 'Filename contains a potentially dangerous embedded extension';
    }
  }
  if (/[<>:"|?*]/.test(file.originalname) || file.originalname.includes('..')) {
    return 'Filename contains invalid or potentially dangerous characters';
  }
  if (file.originalname.length > 255) return 'Filename is too long (max 255 characters)';
  if (RESERVED_NAMES.has(basename))   return 'Filename uses a reserved system name';

  return null;
};

// ===========================
// CLOUDINARY CLEANUP HELPER
// ===========================
const destroyCloudinaryFiles = async (files, reason) => {
  for (const file of files) {
    if (!file.filename) continue;
    try {
      await cloudinary.uploader.destroy(file.filename);
      logger.info(`Cloudinary cleanup (${reason}): deleted ${file.filename}`);
    } catch (err) {
      logger.error(`Cloudinary cleanup failed for ${file.filename} (${reason}):`, err.message);
    }
  }
};

// ===========================
// SHARED RATE LIMIT CHECK
// (post-upload, size-based)
// ===========================
// Returns an error payload object if the limit is exceeded, null otherwise.
const applyPostUploadRateLimit = async (req, files) => {
  if (!req._rateLimitEntry || files.length === 0) return null;

  const entry     = req._rateLimitEntry;
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

  if (entry.size + totalSize > UPLOAD_SIZE_PER_HOUR) {
    await destroyCloudinaryFiles(files, 'size-limit breach');
    const remainingMB = Math.max(0, Math.round((UPLOAD_SIZE_PER_HOUR - entry.size) / 1024 / 1024));
    const minutesLeft = Math.ceil((entry.resetTime - Date.now()) / 60_000);
    return {
      success:    false,
      message:    `Upload size limit exceeded. ${remainingMB} MB remaining this hour.`,
      code:       'UPLOAD_SIZE_LIMIT_EXCEEDED',
      retryAfter: minutesLeft * 60,
    };
  }

  entry.count += files.length;
  entry.size  += totalSize;
  return null;
};

// ===========================
// SHARED MULTER ERROR HANDLER
// ===========================
const FILTER_ERROR_PATTERNS = [
  'Invalid file type','Invalid extension','dangerous embedded extension',
  'invalid or potentially dangerous','too long','reserved system name',
  'exceeds the per-file size limit',
];

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.warn(`Multer error: ${err.code} — ${err.message} — IP: ${req.ip}`);

    const errorMap = {
      LIMIT_FILE_SIZE:       { status: 400, message: `File too large. Maximum allowed is ${Math.round(GLOBAL_MAX_FILE_SIZE / 1024 / 1024)} MB`, code: 'FILE_TOO_LARGE' },
      LIMIT_FILE_COUNT:      { status: 400, message: `Too many files. Maximum is ${GLOBAL_MAX_FILES}`,                                            code: 'TOO_MANY_FILES' },
      LIMIT_UNEXPECTED_FILE: { status: 400, message: `Unexpected field: "${err.field}"`,                                                          code: 'UNEXPECTED_FILE_FIELD' },
      LIMIT_FIELD_VALUE:     { status: 400, message: `Field value too large. Maximum is ${Math.round(FIELD_SIZE_LIMIT / 1024)} KB`,               code: 'FIELD_TOO_LARGE' },
    };

    const mapped = errorMap[err.code] ?? { status: 400, message: `Upload error: ${err.message}`, code: 'UPLOAD_ERROR' };
    return res.status(mapped.status).json({ success: false, ...mapped });
  }

  if (err?.message && FILTER_ERROR_PATTERNS.some((p) => err.message.includes(p))) {
    return res.status(400).json({ success: false, message: err.message, code: 'VALIDATION_ERROR' });
  }

  logger.error('Unexpected upload error:', err);
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred during upload',
    code:    'UPLOAD_SERVER_ERROR',
  });
};

// ===========================================================
// ★ V3: FIELD SCHEMA SYSTEM
// ===========================================================

/**
 * Creates a CloudinaryStorage instance that reads per-field config
 * at upload time. One instance, many field behaviours.
 */
const buildSchemaStorage = (schemas) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
      const schema = schemas[file.fieldname];
      if (!schema) throw new Error(`No schema found for field "${file.fieldname}"`);

      const randomSuffix  = crypto.randomBytes(6).toString('hex');
      const ext           = path.extname(file.originalname).replace('.', '').toLowerCase();
      const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;

      return {
        folder:          schema.folder,
        allowed_formats: [...schema.allowedMimes].map((m) => m.split('/')[1].replace('jpeg', 'jpg')),
        format:          normalizedExt,
        transformation:  schema.transform,
        // fieldname prefix makes public_ids self-describing in the Cloudinary console
        public_id:       `${file.fieldname}_${Date.now()}_${randomSuffix}`,
      };
    },
  });

/**
 * Returns a multer fileFilter that validates each file against
 * the schema for its field. Rejects undeclared fields outright.
 */
const buildSchemaFileFilter = (schemas) => (_req, file, cb) => {
  const schema = schemas[file.fieldname];

  if (!schema) {
    // Field name not in schema — reject with a structured multer error
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), false);
  }

  const securityError = runSecurityChecks(file, schema.allowedMimes, schema.allowedExts);
  if (securityError) return cb(new Error(securityError), false);

  cb(null, true);
};

/**
 * Post-upload middleware: validates per-field size caps, required fields,
 * hourly rate limit, and builds req.uploadedFiles for controllers.
 *
 * Per-file size must be re-checked here because multer's global fileSize
 * limit can't vary per field — we set it to the max across all fields and
 * enforce tighter per-field caps here, cleaning up Cloudinary if needed.
 */
const validateFieldUploads = (schemas) => async (req, res, next) => {
  const uploadedByField = req.files ?? {}; // keyed by fieldname when using upload.fields()
  const allFiles        = Object.values(uploadedByField).flat();

  // ── 1. Per-field size cap ────────────────────────────────────────────────
  // Cloudinary has already accepted the files at this point.
  // Destroy and reject any that exceed their field's individual size limit.
  const oversized = [];
  for (const [fieldname, files] of Object.entries(uploadedByField)) {
    const schema = schemas[fieldname];
    if (!schema) continue;
    for (const file of files) {
      if (file.size > schema.maxSizeBytes) {
        oversized.push({ file, fieldname, maxMB: Math.round(schema.maxSizeBytes / 1024 / 1024) });
      }
    }
  }

  if (oversized.length > 0) {
    await destroyCloudinaryFiles(oversized.map((o) => o.file), 'per-field size limit exceeded');
    const details = oversized.map(
      ({ fieldname, maxMB }) => `"${fieldname}" exceeds the ${maxMB} MB per-file limit`
    );
    return res.status(400).json({
      success: false,
      message: `File size validation failed: ${details.join('; ')}`,
      code:    'FILE_TOO_LARGE',
      details,
    });
  }

  // ── 2. Hourly size rate limit ────────────────────────────────────────────
  const rateLimitError = await applyPostUploadRateLimit(req, allFiles);
  if (rateLimitError) return res.status(429).json(rateLimitError);

  // ── 3. Required field check ──────────────────────────────────────────────
  const missingRequired = Object.entries(schemas)
    .filter(([name, schema]) => schema.required && !uploadedByField[name]?.length)
    .map(([name]) => name);

  if (missingRequired.length > 0) {
    // Roll back any files that did upload before we reject the whole request
    await destroyCloudinaryFiles(allFiles, 'missing required field');
    return res.status(400).json({
      success: false,
      message: `Missing required upload field(s): ${missingRequired.join(', ')}`,
      code:    'MISSING_REQUIRED_FIELD',
      fields:  missingRequired,
    });
  }

  // ── 4. Build req.uploadedFiles ───────────────────────────────────────────
  // Normalised shape — controllers never touch raw multer req.files.
  req.uploadedFiles = {};
  for (const [fieldname, files] of Object.entries(uploadedByField)) {
    req.uploadedFiles[fieldname] = files.map((file) => ({
      fieldname,
      publicId:     file.filename,     // Cloudinary public_id — persist for future deletion
      url:          file.path,         // Cloudinary HTTPS URL  — persist for display
      originalName: file.originalname,
      size:         file.size,
      mimetype:     file.mimetype,
    }));
  }

  const summary = Object.entries(req.uploadedFiles)
    .map(([f, files]) => `${f}(${files.length})`)
    .join(', ');
  logger.info(`Fields uploaded: [${summary}] by ${req.admin?.username ?? req.ip}`);

  next();
};

/**
 * uploadFields(fieldSchemas) → middleware array
 *
 * Build once per route (or share across routes with the same fields).
 * Schema validation runs at call time — misconfigured schemas throw
 * on server start, not on the first upload request.
 */
const uploadFields = (fieldSchemas) => {
  // Normalise all schemas up front
  const normalisedSchemas = Object.fromEntries(
    Object.entries(fieldSchemas).map(([name, schema]) => [
      name,
      normaliseFieldSchema(name, schema),
    ])
  );

  // multer fields descriptor: [{ name, maxCount }, ...]
  const multerFields = Object.entries(normalisedSchemas).map(([name, schema]) => ({
    name,
    maxCount: schema.maxCount,
  }));

  const storage    = buildSchemaStorage(normalisedSchemas);
  const fileFilter = buildSchemaFileFilter(normalisedSchemas);

  const multerInstance = multer({
    storage,
    fileFilter,
    limits: {
      // Total file count = sum of per-field maxCounts
      files:    multerFields.reduce((sum, f) => sum + f.maxCount, 0),
      // Global size cap = largest individual field cap.
      // Tighter per-field caps are enforced in validateFieldUploads.
      fileSize: Math.max(...Object.values(normalisedSchemas).map((s) => s.maxSizeBytes)),
      fieldSize:     FIELD_SIZE_LIMIT,
      fieldNameSize: 100,
      headerPairs:   2000,
    },
  });

  return [
    checkUploadRateLimit,

    (req, res, next) => {
      multerInstance.fields(multerFields)(req, res, (err) => {
        if (err) return handleMulterError(err, req, res, next);
        next();
      });
    },

    validateFieldUploads(normalisedSchemas),
  ];
};

// ===========================================================
// V2 COMPAT: uploadSingle / uploadMultiple
// ===========================================================
// Identical interface to v2 — existing routes need no changes.

const buildLegacyStorage = () =>
  new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
      const randomSuffix  = crypto.randomBytes(6).toString('hex');
      const ext           = path.extname(file.originalname).replace('.', '').toLowerCase();
      const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;
      return {
        folder:          'portfolio/about',
        allowed_formats: ['jpg','jpeg','png','webp','gif'],
        format:          normalizedExt,
        transformation:  [{ width: GLOBAL_MAX_IMAGE_WIDTH, height: GLOBAL_MAX_IMAGE_HEIGHT, crop: 'limit', quality: 'auto' }],
        public_id:       `${file.fieldname}_${Date.now()}_${randomSuffix}`,
      };
    },
  });

const legacyFileFilter = (_req, file, cb) => {
  const err = runSecurityChecks(file, DEFAULT_ALLOWED_MIMES, DEFAULT_ALLOWED_EXTS);
  err ? cb(new Error(err), false) : cb(null, true);
};

const legacyUpload = multer({
  storage:    buildLegacyStorage(),
  fileFilter: legacyFileFilter,
  limits: {
    fileSize:      GLOBAL_MAX_FILE_SIZE,
    files:         GLOBAL_MAX_FILES,
    fieldSize:     FIELD_SIZE_LIMIT,
    fieldNameSize: 100,
    headerPairs:   2000,
  },
});

const validateUploadedFile = (required = true) => async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  if (files.length === 0) {
    if (required) {
      return res.status(400).json({ success: false, message: 'No files were uploaded', code: 'NO_FILES_UPLOADED' });
    }
    return next();
  }

  const rateLimitError = await applyPostUploadRateLimit(req, files);
  if (rateLimitError) return res.status(429).json(rateLimitError);

  // v2 flat array shape — preserved for backward compatibility
  req.fileValidation = files.map((file) => ({
    filename:     file.filename,
    originalName: file.originalname,
    valid:        true,
    warnings:     [],
    metadata: {
      url:      file.path,
      publicId: file.filename,
      size:     file.size,
      mimetype: file.mimetype,
    },
  }));

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const label = files.length === 1
    ? `${files[0].originalname} → ${files[0].filename}`
    : `${files.length} files`;
  logger.info(`Upload OK: ${label} (${totalBytes} bytes) by ${req.admin?.username ?? req.ip}`);

  next();
};

const createUploadMiddleware = (type = 'single', required = true) => [
  checkUploadRateLimit,
  (req, res, next) => {
    const handler =
      type === 'multiple'
        ? legacyUpload.array('files', GLOBAL_MAX_FILES)
        : legacyUpload.single('file');

    handler(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  validateUploadedFile(required),
];

// ===========================
// EXPORTS
// ===========================
module.exports = {
  // ★ v3 — named field schemas
  uploadFields,

  // v2 compat — interface unchanged
  uploadSingle:   createUploadMiddleware('single',   true),
  uploadMultiple: createUploadMiddleware('multiple', true),

  // Escape hatches for custom compositions
  checkUploadRateLimit,
  validateUploadedFile,
  handleMulterError,

  // Diagnostics
  getUploadStats: () => ({ activeRateLimitEntries: uploadRateLimit.size }),
};