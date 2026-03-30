// utils/helpers.js
const winston = require('winston');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const emailConfig = require('../config/email');
const RefreshToken = require('../models/RefreshToken');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'portfolio-api' }, // Removed requestId function
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          // Stringify message if it's an object
          const formattedMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
          // Include requestId in meta if provided
          const metaString = Object.keys(meta).length ? JSON.stringify({ ...meta, requestId: meta.requestId || crypto.randomUUID() }, null, 2) : '';
          return `${timestamp} [${level}] ${formattedMessage}${metaString ? ` ${metaString}` : ''}`;
        })
      ),
    }),
  ],
});

// Email transporter
const transporter = nodemailer.createTransport(emailConfig.smtp);

// HTML escape
const escapeHtml = (unsafe) => {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Send contact notification email
const sendContactNotification = async (contact) => {
  try {
    const mailOptions = {
      from: emailConfig.from,
      to: emailConfig.adminEmail,
      subject: 'New Contact Form Submission',
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(contact.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(contact.subject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(contact.message).replace(/\n/g, '<br>')}</p>
        <p><strong>Submitted:</strong> ${new Date(contact.createdAt).toLocaleString()}</p>
        <p><strong>IP Address:</strong> ${escapeHtml(contact.ipAddress)}</p>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info('Contact notification email sent successfully', {
      email: contact.email,
      ip: contact.ipAddress,
      requestId: crypto.randomUUID(),
    });
  } catch (error) {
    logger.error('Failed to send contact notification email', {
      message: error.message,
      stack: error.stack,
      email: contact.email,
      requestId: crypto.randomUUID(),
    });
    throw error;
  }
};

const deleteUploadedFiles = async (filenames) => {
  try {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    await Promise.all(
      filenames.map(async (filename) => {
        const filePath = path.join(uploadDir, filename);
        try {
          await fs.access(filePath);
          await fs.unlink(filePath);
          logger.info('Deleted file', { filename, requestId: crypto.randomUUID() });
        } catch {
          logger.warn('File not found or already deleted', { filename, requestId: crypto.randomUUID() });
        }
      })
    );
  } catch (error) {
    logger.error('Error deleting files', {
      message: error.message,
      stack: error.stack,
      filenames,
      requestId: crypto.randomUUID(),
    });
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// Helpers
const formatValidationErrors = (errors) => errors.map((e) => ({ field: e.path.join('.'), message: e.message }));

const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
};

// Standardized API responses
const errorResponse = (res, statusCode, message, code, additionalData = {}) => {
  const response = { success: false, message, code, ...additionalData };
  logger.warn(message, {
    error: response,
    stack: additionalData.stack || new Error().stack, // Include stack if provided
    requestId: res.locals.requestId || crypto.randomUUID(),
  });
  return res.status(statusCode).json(response);
};

const successResponse = (res, message, data = null, statusCode = 200) => {
  const response = { success: true, message };
  if (data) response.data = data;
  logger.info(message, { response, requestId: res.locals.requestId || crypto.randomUUID() });
  return res.status(statusCode).json(response);
};

// Password validation
const validatePassword = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);

// Device info helper
const getDeviceInfo = (req) => {
  const ua = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  const deviceType = ua.toLowerCase().includes('mobile') || ua.toLowerCase().includes('android') || ua.toLowerCase().includes('iphone')
    ? 'mobile'
    : ua.toLowerCase().includes('tablet') || ua.toLowerCase().includes('ipad') ? 'tablet' : 'desktop';

  return { userAgent: ua, ipAddress: ip, deviceType, location: req.geoLocation || null };
};

// Suspicious login detection
const checkSuspiciousLogin = async (admin, req) => {
  const recentTokens = await RefreshToken.find({
    adminId: admin._id,
    isRevoked: false,
    createdAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  }).limit(5);

  const currentDevice = getDeviceInfo(req);
  const isSuspicious =
    recentTokens.length > 0 &&
    !recentTokens.some(
      (token) => token.deviceInfo.ipAddress === currentDevice.ipAddress || token.deviceInfo.deviceType === currentDevice.deviceType
    );

  if (isSuspicious) {
    logger.warn(`Suspicious login detected for admin: ${admin.username}`, {
      ip: currentDevice.ipAddress,
      deviceType: currentDevice.deviceType,
      requestId: crypto.randomUUID(),
    });
  }

  return isSuspicious;
};

// Configuration constants
const CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MIN: 15,
  MAX_LOCK_DURATION_MIN: 60,
  TOKEN_CLEANUP_DAYS: 30,
  RECENT_TOKENS_LIMIT: 5,
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
};

// Failed attempts tracking for rate limiting
const failedAttemptsStore = new Map();

const getFailedAttemptsCount = () => {
  return Array.from(failedAttemptsStore.values()).reduce((sum, data) => sum + data.count, 0);
};

const clearFailedAttempts = () => {
  failedAttemptsStore.clear();
  logger.info('Failed attempts store cleared', { requestId: crypto.randomUUID() });
};

const recordFailedAttempt = (identifier) => {
  const current = failedAttemptsStore.get(identifier) || { count: 0, firstAttempt: Date.now() };
  current.count++;
  failedAttemptsStore.set(identifier, current);

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    failedAttemptsStore.delete(identifier);
  }, 60 * 60 * 1000);
};

module.exports = {
  logger,
  sendContactNotification,
  deleteUploadedFiles,
  fileExists,
  formatValidationErrors,
  generateRandomString,
  sanitizeFilename,
  errorResponse,
  successResponse,
  validatePassword,
  getDeviceInfo,
  checkSuspiciousLogin,
  CONFIG,
  getFailedAttemptsCount,
  clearFailedAttempts,
  recordFailedAttempt,
};