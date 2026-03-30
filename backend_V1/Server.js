const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Optional security middleware with graceful fallbacks
let hpp;
try {
  hpp = require('hpp');
} catch (err) {
  console.warn('Warning: hpp not installed. Install with: npm install hpp');
}

const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/helpers');
const {
  generalRateLimit,
  contactRateLimit,
  loginRateLimit,
  getFailedAttemptsCount,
  clearFailedAttempts
} = require('./middleware/security');

// Import routes
const contactRoutes = require('./routes/contacts');
const projectRoutes = require('./routes/projects');
const skillRoutes = require('./routes/skills');
const experienceRoutes = require('./routes/experience');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/uploads');
const profileRoutes = require('./routes/profile');
const aboutRoutes = require('./routes/about');
const subscriberRoutes = require('./routes/subscribers');

// Database configuration
const db = require('./config/database');

// Environment variables validation
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  logger.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// ✅ Validate JWT_SECRET strength
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters for security');
  logger.error('Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const API_VERSION = process.env.API_VERSION || 'v1';

// ===========================
// TRUST PROXY & BASIC SETUP
// ===========================
if (IS_PRODUCTION) {
  app.set('trust proxy', process.env.TRUST_PROXY || 1);
  logger.info('Trust proxy enabled for production');
} else {
  app.set('trust proxy', false);
}

// Disable x-powered-by header for security
app.disable('x-powered-by');

// ===========================
// UPLOADS DIRECTORY SETUP
// ===========================
const uploadDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`Created uploads directory: ${uploadDir}`);
  }
} catch (error) {
  logger.error('Failed to create uploads directory:', error);
  if (IS_PRODUCTION) {
    process.exit(1);
  }
}

// ===========================
// SECURITY MIDDLEWARE
// ===========================
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", ...(IS_PRODUCTION ? [] : ["'unsafe-inline'", "'unsafe-eval'"])],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", ...(IS_PRODUCTION ? [] : ["ws:", "wss:"])],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: IS_PRODUCTION ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: IS_PRODUCTION ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
};

app.use(helmet(helmetConfig));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // API-specific headers
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// ===========================
// PERFORMANCE MIDDLEWARE
// ===========================
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    if (req.headers['cache-control']?.includes('no-transform')) return false;
    return compression.filter(req, res);
  },
  level: IS_PRODUCTION ? 6 : 1,
  threshold: 1024,
  memLevel: 8,
}));

// ===========================
// CORS CONFIGURATION
// ===========================
const getAllowedOrigins = () => {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.split(',').map(url => url.trim());
  }
  if (!IS_PRODUCTION) {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://localhost:8080',
       'http://localhost:5173',   // ✅ Vite dev server
    'http://127.0.0.1:5173'    // optional, covers 127.0.0.1 access
    ];
  }
  return [];
};

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin in development (e.g., mobile apps, Postman)
    if (!origin && !IS_PRODUCTION) {
      return callback(null, true);
    }

    if (!origin && IS_PRODUCTION) {
      logger.warn('Request with no origin blocked in production');
      return callback(new Error('Origin required in production'));
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key',
    'Cache-Control'
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  optionsSuccessStatus: 200,
  maxAge: IS_PRODUCTION ? 86400 : 300
};

app.use(cors(corsOptions));

// ===========================
// BODY PARSING
// ===========================
const jsonLimit = process.env.JSON_LIMIT || (IS_PRODUCTION ? '5mb' : '10mb');
const urlencodedLimit = process.env.URLENCODED_LIMIT || (IS_PRODUCTION ? '5mb' : '10mb');

app.use(express.json({
  limit: jsonLimit,
  verify: (req, res, buf, encoding) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: urlencodedLimit
}));



// ===========================
// REQUEST ID TRACKING
// ===========================
const crypto = require('crypto');

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});


// ===========================
// SECURITY: SANITIZATION (FIXED)
// ===========================

// Custom sanitization middleware - compatible with all Node.js versions
const customMongoSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);

    const safe = {};
    for (const key in obj) {
      // Block dangerous keys
      if (
        key.startsWith('$') ||
        key.includes('.') ||
        key.includes('<') ||
        key.includes('>') ||
        key.includes('javascript:') ||
        key.includes('data:text/html')
      ) {
        logger.warn(`Blocked dangerous key: "${key}" in ${req.method} ${req.path}`);
        continue;
      }
      safe[key] = sanitize(obj[key]);
    }
    return safe;
  };

  try {
    if (req.body && typeof req.body === 'object') req.body = sanitize(req.body);
    if (req.query && typeof req.query === 'object') req.query = sanitize(req.query);
    if (req.params && typeof req.params === 'object') req.params = sanitize(req.params);
  } catch (error) {
    logger.error('Sanitization error:', error);
  }

  next();
};

// Always use custom sanitizer (instead of express-mongo-sanitize)
app.use(customMongoSanitize);
logger.info('Using custom sanitization middleware (Node.js compatible)');

// HTTP Parameter Pollution protection
if (hpp) {
  app.use(hpp({
    whitelist: ['tags', 'categories', 'skills', 'types', 'statuses']
  }));
}

// ===========================
// STATIC FILE SERVING
// ===========================
// Serve uploaded files with security headers
app.use('/uploads', express.static(uploadDir, {
  maxAge: IS_PRODUCTION ? '1y' : '1h',
  etag: true,
  lastModified: true,
  index: false, // Prevent directory listings
  dotfiles: 'deny', // Block access to dotfiles
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', IS_PRODUCTION ?
      'public, max-age=31536000, immutable' :
      'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// ===========================
// RATE LIMITING
// ===========================
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
  // Apply general rate limiting in production
  if (IS_PRODUCTION) {
    app.use(generalRateLimit);
  }

  // API-specific rate limiting
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: IS_PRODUCTION ? 1000 : 2000,
    message: {
      success: false,
      message: 'Too many API requests. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and certain admin endpoints
      return req.path === '/api/health' ||
        req.path === '/api/status' ||
        (req.path.startsWith('/api/admin') && req.method === 'GET');
    }
  }));
}

// ===========================
// REQUEST LOGGING
// ===========================
if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
  app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

      logger[logLevel]({
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100)
      });
    });

    next();
  });
}

// ===========================
// API ROUTES
// ===========================
// Enhanced health check
app.get('/api/health', async (req, res) => {
  try {
    // ✅ Actually test database connection
    let dbHealthy = false;
    try {
      dbHealthy = await db.ping();
    } catch (err) {
      logger.error('Database health check failed:', err);
    }

    const healthData = {
      status: dbHealthy ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      apiVersion: API_VERSION,
      checks: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          ...db.getConnectionInfo()
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        }
      },
      rateLimiting: {
        enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
        failedAttempts: getFailedAttemptsCount?.() || 0
      }
    }; // ✅ CLOSING BRACE WAS MISSING HERE

    // Add additional checks in production
    if (IS_PRODUCTION) {
      // Check if uploads directory is writable
      try {
        const testFile = path.join(uploadDir, '.health-check-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        healthData.uploadsWritable = true;
      } catch (error) {
        healthData.uploadsWritable = false;
        healthData.uploadsError = error.message;
      }
    }

    const statusCode = healthData.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(healthData);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple status endpoint for load balancers
app.get('/api/status', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// API versioning
const apiRouter = express.Router();

// Apply routes to versioned API
apiRouter.use('/contacts', contactRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/skills', skillRoutes);
apiRouter.use('/experiences', experienceRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/profile', profileRoutes);
apiRouter.use('/about', aboutRoutes); 
apiRouter.use('/', subscriberRoutes);


// Mount API router
app.use(`/api/${API_VERSION}`, apiRouter);
// Also mount on /api for backward compatibility
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Portfolio API Server',
    version: process.env.npm_package_version || '1.0.0',
    apiVersion: API_VERSION,
    environment: NODE_ENV,
    documentation: '/api/health',
    endpoints: {
      health: '/api/health',
      contacts: '/api/contacts',
      projects: '/api/projects',
      skills: '/api/skills',
      experiences: '/api/experiences',
      admin: '/api/admin',
      uploads: '/api/uploads'
    }
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Portfolio API Documentation',
    version: API_VERSION,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      public: {
        'GET /contacts': 'Submit contact form',
        'GET /projects': 'Get published projects',
        'GET /skills': 'Get active skills',
        'GET /experiences': 'Get active experiences'
      },
      admin: {
        'POST /admin/login': 'Admin login',
        'POST /admin/refresh': 'Refresh access token',
        'POST /admin/logout': 'Admin logout',
        'GET /admin/profile': 'Get admin profile',
        'PUT /admin/profile': 'Update admin profile'
      }
    },
    authentication: 'Bearer token required for admin endpoints',
    rateLimiting: {
      general: '100 requests per 15 minutes',
      api: IS_PRODUCTION ? '1000 requests per 15 minutes' : '2000 requests per 15 minutes',
      contact: '5 requests per hour',
      login: '5 attempts per 15 minutes'
    }
  });
});

// ===========================
// ERROR HANDLING
// ===========================
// 404 handler for unknown routes
app.use((req, res, next) => {
  const error = {
    success: false,
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  logger.warn(`404 - Route not found: ${req.method} ${req.path} - IP: ${req.ip}`);
  res.status(404).json(error);
});

// Global error handler
app.use(errorHandler);

// ===========================
// GRACEFUL SHUTDOWN
// ===========================
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Close database connection
    await db.disconnect();
    logger.info('Database disconnected successfully');

    // Clear any intervals/timeouts
    if (clearFailedAttempts) {
      clearFailedAttempts();
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};



const performStartupChecks = async () => {
  const checks = [
    {
      name: 'Uploads Directory Writable',
      check: async () => {
        const testFile = path.join(uploadDir, '.startup-test');
        await fs.promises.writeFile(testFile, 'test');
        await fs.promises.unlink(testFile);
        return true;
      }
    },
    {
      name: 'Database Connection',
      check: async () => await db.ping()
    },
    {
      name: 'JWT Secret Strength',
      check: () => process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    }
  ];

  for (const { name, check } of checks) {
    try {
      await check();
      logger.info(`✓ Startup check passed: ${name}`);
    } catch (error) {
      logger.error(`✗ Startup check failed: ${name}`, error);
      if (IS_PRODUCTION) {
        throw new Error(`Critical startup check failed: ${name}`);
      }
    }
  }
};
// ===========================
// SERVER START
// ===========================
(async () => {
  try {
    // ✅ Run startup checks first
    await performStartupChecks();
    
    // Connect to database
    await db.connect();
    logger.info('Database connected successfully');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT} [${NODE_ENV}]`);
      logger.info(`API Documentation: http://localhost:${PORT}/api/docs`);
      logger.info(`Health Check: http://localhost:${PORT}/api/health`);

      if (!IS_PRODUCTION) {
        logger.info(`Upload Directory: ${uploadDir}`);
        logger.info('Development mode: CORS allows localhost origins');
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use.`);
        logger.error('Please try a different port or stop the existing server.');
      } else if (error.code === 'EACCES') {
        logger.error(`Permission denied to bind to port ${PORT}.`);
        logger.error('Try using a port number above 1024 or run with elevated privileges.');
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

    // Graceful shutdown handlers
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      if (IS_PRODUCTION) {
        gracefulShutdown('UNHANDLED_REJECTION');
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();

module.exports = app;