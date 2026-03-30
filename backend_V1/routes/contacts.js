// routes/contacts.js - Complete Backend Routes
const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/ContactController');
const { 
  authenticateToken, 
  requireAdmin 
} = require('../middleware/admin');
const { 
  contactRateLimit 
} = require('../middleware/security');

// ===========================
// PUBLIC ROUTES
// ===========================
// Submit contact form (rate limited)
router.post('/', 
  ContactController.create
);

// ===========================
// ADMIN ROUTES
// ===========================
// Apply authentication to all routes below
router.use(authenticateToken, requireAdmin);

// Get contact statistics (must come before /:id to avoid conflict)
router.get('/stats', ContactController.getStats);

// Bulk operations
router.patch('/bulk', ContactController.bulkOperation);

// Get all contacts with pagination and filtering
router.get('/', ContactController.getAll);

// Get specific contact by ID
router.get('/:id', ContactController.getById);

// Mark contact as read - NEW ENDPOINT
router.patch('/:id/read', ContactController.markAsRead);

// Reply to contact - NEW ENDPOINT
router.post('/:id/reply', ContactController.reply);

// Update contact status (generic status update)
router.patch('/:id/status', ContactController.updateStatus);

// Delete contact
router.delete('/:id', ContactController.delete);

module.exports = router;