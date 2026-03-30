
// ===========================
// routes/index.js (Main Router)
// ===========================
const express = require('express');
const router = express.Router();

// Import all route modules
const contactRoutes = require('./contacts');
const projectRoutes = require('./projects');
const skillRoutes = require('./skills');
const experienceRoutes = require('./experience');
const adminRoutes = require('./admin');
const uploadRoutes = require('./uploads');

// API route mounting with consistent naming
router.use('/contacts', contactRoutes);
router.use('/projects', projectRoutes);
router.use('/skills', skillRoutes);
router.use('/experiences', experienceRoutes); // Changed from 'experience' to 'experiences'
router.use('/admin', adminRoutes);
router.use('/uploads', uploadRoutes);

// API documentation route
router.get('/docs', (req, res) => {
  res.json({
    title: 'Portfolio API Routes',
    version: '1.0.0',
    routes: {
      contacts: {
        'POST /contacts': 'Create contact submission',
        'GET /contacts': 'Get all contacts (Admin)',
        'GET /contacts/stats': 'Get contact statistics (Admin)',
        'GET /contacts/:id': 'Get contact by ID (Admin)',
        'PATCH /contacts/:id/status': 'Update contact status (Admin)',
        'DELETE /contacts/:id': 'Delete contact (Admin)'
      },
      projects: {
        'GET /projects/published': 'Get published projects',
        'GET /projects/published/:id': 'Get published project by ID',
        'GET /projects/categories': 'Get project categories',
        'GET /projects': 'Get all projects (Admin)',
        'GET /projects/stats': 'Get project statistics (Admin)',
        'POST /projects': 'Create project (Admin)',
        'PUT /projects/:id': 'Update project (Admin)',
        'DELETE /projects/:id': 'Delete project (Admin)'
      },
      skills: {
        'GET /skills/active': 'Get active skills',
        'GET /skills/categories': 'Get skill categories',
        'GET /skills': 'Get all skills (Admin)',
        'POST /skills': 'Create skill (Admin)',
        'PUT /skills/:id': 'Update skill (Admin)',
        'DELETE /skills/:id': 'Delete skill (Admin)',
        'PATCH /skills/order': 'Update skill order (Admin)'
      },
      experiences: {
        'GET /experiences/active': 'Get active experiences',
        'GET /experiences/date-range': 'Get experiences by date range',
        'GET /experiences': 'Get all experiences (Admin)',
        'GET /experiences/stats': 'Get experience statistics (Admin)',
        'POST /experiences': 'Create experience (Admin)',
        'PUT /experiences/:id': 'Update experience (Admin)',
        'DELETE /experiences/:id': 'Delete experience (Admin)'
      },
      admin: {
        'POST /admin/login': 'Admin login',
        'POST /admin/refresh-token': 'Refresh access token',
        'POST /admin/logout': 'Admin logout',
        'GET /admin/profile': 'Get admin profile',
        'PUT /admin/profile': 'Update admin profile',
        'POST /admin/change-password': 'Change password'
      },
      uploads: {
        'GET /uploads/:filename': 'Serve uploaded file',
        'POST /uploads/single': 'Upload single file (Admin)',
        'POST /uploads/multiple': 'Upload multiple files (Admin)',
        'GET /uploads': 'List uploaded files (Admin)',
        'DELETE /uploads/:filename': 'Delete file (Admin)'
      }
    }
  });
});

module.exports = router;