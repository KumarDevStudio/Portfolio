

// Updated: src/config/email.js (environment-specific)
module.exports = {
  smtp: {
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  },
  from: process.env.EMAIL_FROM || 'no-reply@portfolio.com',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@portfolio.com'
};


