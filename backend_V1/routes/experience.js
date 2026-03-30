const express = require('express');
const router = express.Router();
const ExperienceController = require('../controllers/ExperienceController');
const { adminAuth } = require('../middleware/admin');

// ─── Upload middleware ────────────────────────────────────────────────────────
// Adjust the multer setup to match your storage strategy (disk / Cloudinary / S3).
// The field name must be "companyLogo" to match the Admin UI <input name="companyLogo">.
//
// Example disk-storage setup (replace with your own config import):
//
//   const multer = require('multer');
//   const upload = multer({ dest: 'uploads/' });
//
// If you already have a shared upload middleware exported from e.g.
// '../middleware/upload', import it here instead.
const multer = require('multer');
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

const logoUpload = upload.single('companyLogo');

// ===========================
// PUBLIC ROUTES
// ===========================

// Get all active experiences (with optional filters: type, current, featured)
router.get('/active', ExperienceController.getActive);

// Get experiences by date range
router.get('/date-range', ExperienceController.getByDateRange);

// ===========================
// ADMIN ROUTES (Protected)
// ===========================
router.use(adminAuth);

// Get experience statistics (must stay before /:id)
router.get('/stats', ExperienceController.getStats);

// Update experience order (must stay before /:id)
router.patch('/order', ExperienceController.updateOrder);

// Get all experiences with pagination and filters
router.get('/', ExperienceController.getAll);

// Get single experience by ID
router.get('/:id', ExperienceController.getById);

// Create new experience  ← multer parses the multipart body so req.file is set
router.post('/', logoUpload, ExperienceController.create);

// Update experience  ← same
router.put('/:id', logoUpload, ExperienceController.update);

// Delete experience
router.delete('/:id', ExperienceController.delete);

module.exports = router;