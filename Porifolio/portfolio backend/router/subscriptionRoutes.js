const express = require('express');
const router = express.Router();
const { subscribe } = require('../controller/subscriptionController');

router.post('/subscribe', subscribe);

module.exports = router;
