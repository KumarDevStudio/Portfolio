
// config/environments/production.js
module.exports = {
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: '7d'
  },

  email: {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM
  },

  upload: {
    maxSize: 2 * 1024 * 1024, // 2MB in production
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    destination: 'uploads/'
  },

  security: {
    bcryptRounds: 12,
    rateLimitWindow: 15 * 60 * 1000,
    rateLimitMax: 50 // Stricter in production
  }
};

