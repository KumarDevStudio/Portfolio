const express = require('express');
const router = express.Router();
const ProjectController = require('../controllers/ProjectController');
const { adminAuth } = require('../middleware/admin');
const { validateObjectId } = require('../middleware/validation');
const { deleteUploadedFiles } = require('../utils/helpers');
const multer = require('multer');

// ── Multer config ──────────────────────────────────────────────────────────────
// FIX 4 & 5: add fileFilter for image-only uploads and a per-file size cap
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Pass an error — multer will abort the upload and forward to next(err)
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Wrapper that converts multer errors into proper Express next(err) calls
// FIX 2: multer throws synchronously, bypassing router-level error handlers.
// This wrapper catches those errors and forwards them correctly.
function uploadMiddleware(req, res, next) {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}

// ── PUBLIC routes ──────────────────────────────────────────────────────────────
router.get('/published', ProjectController.getPublished);
router.get('/published/:id', validateObjectId, ProjectController.getPublishedById);
router.get('/categories', ProjectController.getCategories);

// ── ADMIN routes ───────────────────────────────────────────────────────────────
router.use(adminAuth);

router.get('/', ProjectController.getAll);

// FIX 1: /stats MUST be registered before /:id — otherwise Express matches
// "stats" as an ObjectId param and validateObjectId rejects it with a 400.
router.get('/stats', ProjectController.getStats);

router.get('/:id', validateObjectId, ProjectController.getById);
router.post('/', ProjectController.create);
router.put('/:id', validateObjectId, ProjectController.update);
router.delete('/:id', validateObjectId, ProjectController.delete);

router.post(
  '/:id/images',
  validateObjectId,
  uploadMiddleware, // FIX 2: uses wrapper so multer errors reach the handler below
  ProjectController.uploadImages
);

router.delete('/:id/images/:publicId', validateObjectId, ProjectController.deleteImage);

// ── Router-level error handler ─────────────────────────────────────────────────
// FIX 3: always clean up temp files regardless of where in the chain the error
// originated — req.files is populated by multer before any route handler runs.
router.use((error, req, res, next) => {
  console.error('[ProjectRouter error]', error);

  if (req.files?.length > 0) {
    const filenames = req.files.map((f) => f.filename);
    deleteUploadedFiles(filenames).catch((cleanupErr) =>
      console.error('[ProjectRouter] temp file cleanup failed:', cleanupErr)
    );
  }

  // Distinguish multer-specific errors for a cleaner client message
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 5 MB per image.',
    });
  }

  if (error.message?.startsWith('Unsupported file type')) {
    return res.status(415).json({
      success: false,
      message: error.message,
    });
  }

  res.status(500).json({
    success: false,
    message: 'An error occurred',
    error: error.message,
  });
});

module.exports = router;