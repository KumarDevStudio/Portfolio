// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { logger } = require('../utils/helpers');

let isVerified = false;

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  const config = cloudinary.config();
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    logger.error('Cloudinary configuration incomplete!', {
      service: 'portfolio-api',
      hasCloudName: !!config.cloud_name,
      hasApiKey: !!config.api_key,
      hasApiSecret: !!config.api_secret
    });
    throw new Error('Cloudinary credentials missing in environment variables');
  }

  logger.info('Cloudinary configured successfully', {
    service: 'portfolio-api',
    cloudName: config.cloud_name
  });
  isVerified = true;
}

// Only configure once
if (!isVerified) {
  configureCloudinary();
}

module.exports = cloudinary;
