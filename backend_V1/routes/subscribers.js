const express = require('express');
const router = express.Router();
const { subscribe, getAllSubscribers, unsubscribe } = require('../controllers/subscriberController');
const { contactRateLimit } = require('../middleware/security');

// POST /api/subscribe — public
router.post('/subscribe', contactRateLimit, subscribe);

// GET /api/subscribers — admin only (add your existing auth middleware here)
// e.g. router.get('/subscribers', authMiddleware, getAllSubscribers);
router.get('/subscribers', getAllSubscribers);

// DELETE /api/unsubscribe — public
router.delete('/unsubscribe', unsubscribe);

module.exports = router;