const { adminAuth } = require('./admin');
const { generalRateLimit, contactRateLimit, loginRateLimit } = require('./security');
const { uploadMiddleware, uploadMultiple } = require('./upload');
const { errorHandler } = require('./errorHandler');

module.exports = {
  adminAuth,
  generalRateLimit,
  contactRateLimit,
  loginRateLimit,
  uploadMiddleware,
  uploadMultiple,
  errorHandler
};