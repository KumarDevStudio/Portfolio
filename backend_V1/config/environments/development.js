
// config/environments/development.js
module.exports = {
  database: {
    uri: 'mongodb://localhost:27017/portfolioDB',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  jwt: {
    secret: 'dev-jwt-secret-key-change-in-production',
    expiresIn: '1h',
    refreshSecret: 'dev-refresh-secret-key',
    refreshExpiresIn: '7d'
  },

  email: {
    service: 'gmail',
    user: 'your-dev-email@gmail.com',
    pass: 'your-app-password',
    from: 'Portfolio <noreply@portfolio.dev>'
  },

  upload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    destination: 'uploads/'
  },

  security: {
    bcryptRounds: 10,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100 // requests per window
  }
};
