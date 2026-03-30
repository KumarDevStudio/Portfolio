// ===========================
// routes/skills.js - FIXED VERSION
// ===========================
const express = require('express');
const router = express.Router();
const SkillController = require('../controllers/SkillController');
const { adminAuth } = require('../middleware/admin');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });
// ===========================
// PUBLIC ROUTES
// ===========================
router.get('/active', SkillController.getActive);
router.get('/categories', SkillController.getCategories);

// ===========================
// ADMIN ROUTES
// ===========================
router.use(adminAuth); // Apply admin auth to all routes below

// IMPORTANT: Order-specific routes BEFORE parameterized routes
router.get('/stats', SkillController.getStatistics);
router.patch('/order', SkillController.updateOrder);
router.patch('/bulk-status', SkillController.bulkUpdateStatus);

// Parameterized routes (must come after specific routes)
router.get('/', SkillController.getAll);
router.get('/:id', SkillController.getById);
router.post('/', upload.single('icon'), SkillController.create);
router.put('/:id', upload.single('icon'), SkillController.update);
router.delete('/:id', SkillController.delete);

module.exports = router;