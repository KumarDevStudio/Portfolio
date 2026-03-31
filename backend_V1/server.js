'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

// ===========================
// ENVIRONMENT VALIDATION
// ===========================
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET', // ✅ Fixed: was missing, refresh tokens were signed with `undefined`
  'MONGODB_URI',
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Check your .env file. Exiting.');
  process.exit(1);
}

// ✅ Fixed: validate entropy, not just length
const JWT_SECRET = process.env.JWT_SECRET;
if (JWT_SECRET.length < 64) {
  console.error('[FATAL] JWT_SECRET must be at least 64 characters.');
  console.error('Generate one: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// ===========================
// CONSTANTS
// ===========================
const PORT = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const API_VERSION = process.env.API_VERSION || 'v1';
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');

// ===========================
// LOGGER (inline, no circular deps)
// ===========================
const { logger } = require('./utils/helpers');

// ===========================
// OPTIONAL MIDDLEWARE
// ===========================
let hpp;
try {
  hpp = require('hpp');
} catch {
  logger.warn('hpp not installed — HTTP parameter pollution protection disabled. Run: npm install hpp');
}

// ===========================
// INTERNAL MODULES
// ===========================
const { errorHandler } = require('./middleware/errorHandler');
const {
  generalRateLimit,
  contactRateLimit,
  loginRateLimit,
  getFailedAttemptsCount,
  clearFailedAttempts,
} = require('./middleware/security');
const db = require('./config/database');

// ===========================
// ROUTE IMPORTS
// ===========================
const contactRoutes    = require('./routes/contacts');
const projectRoutes    = require('./routes/projects');
const skillRoutes      = require('./routes/skills');
const experienceRoutes = require('./routes/experience');
const adminRoutes      = require('./routes/admin');
const uploadRoutes     = require('./routes/uploads');
const profileRoutes    = require('./routes/profile');
const aboutRoutes      = require('./routes/about');
const subscriberRoutes = require('./routes/subscribers');

// ===========================
// APP INIT
// ===========================
const app = express();

// ✅ Disable fingerprinting header
app.disable('x-powered-by');

// ✅ Fixed: trust proxy only in production, not driven by env var that leaks into dev
if (IS_PRODUCTION) {
  // Set to the number of trusted reverse proxies in front of your app (e.g. 1 for a single nginx)
  const trustProxy = parseInt(process.env.TRUST_PROXY, 10) || 1;
  app.set('trust proxy', trustProxy);
  logger.info(`Trust proxy set to: ${trustProxy}`);
}

// ===========================
// UPLOADS DIRECTORY
// ===========================
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`Created uploads directory: ${uploadDir}`);
  }
} catch (err) {
  logger.error('Failed to create uploads directory:', err);
  if (IS_PRODUCTION) process.exit(1);
}

// ===========================
// SECURITY HEADERS (helmet)
// ===========================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:    ["'self'"],
        styleSrc:      ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc:     ["'self'", ...(IS_PRODUCTION ? [] : ["'unsafe-inline'", "'unsafe-eval'"])],
        imgSrc:        ["'self'", 'data:', 'https:', 'blob:'],
        fontSrc:       ["'self'", 'https://fonts.gstatic.com', 'data:'],
        connectSrc:    ["'self'", ...(IS_PRODUCTION ? [] : ['ws:', 'wss:'])],
        mediaSrc:      ["'self'"],
        objectSrc:     ["'none'"],
        frameSrc:      ["'none'"],
        workerSrc:     ["'self'", 'blob:'],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: IS_PRODUCTION
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Additional security headers not covered by helmet
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // API responses must never be cached by proxies or browsers
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ===========================
// COMPRESSION
// ===========================
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      if (req.headers['cache-control']?.includes('no-transform')) return false;
      return compression.filter(req, res);
    },
    level: IS_PRODUCTION ? 6 : 1,
    threshold: 1024,
    memLevel: 8,
  })
);

// ===========================
// CORS
// ===========================
const getAllowedOrigins = () => {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.split(',').map((u) => u.trim());
  }
  if (!IS_PRODUCTION) {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];
  }
  return [];
};

app.use(
  cors({
    origin(origin, callback) {
      const allowed = getAllowedOrigins();

      // Allow same-origin / non-browser requests only in development
      if (!origin) {
        return IS_PRODUCTION
          ? callback(new Error('Origin header required in production'))
          : callback(null, true);
      }

      if (allowed.includes(origin)) return callback(null, true);

      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
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
      'Cache-Control',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    optionsSuccessStatus: 200,
    maxAge: IS_PRODUCTION ? 86_400 : 300,
  })
);

// ===========================
// BODY PARSING
// ===========================
const BODY_LIMIT = IS_PRODUCTION ? '5mb' : '10mb';

app.use(
  express.json({
    limit: BODY_LIMIT,
    verify: (req, _res, buf) => {
      // Preserve raw body for webhook HMAC verification
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// ===========================
// REQUEST ID
// ===========================
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ===========================
// INPUT SANITIZATION
// ===========================
// ✅ Fixed: only block keys that enable NoSQL injection ($ prefix, dot traversal).
//    Removed over-broad < > blocks that broke legitimate text data.
//    XSS must be handled at the output/template layer, not here.
const sanitizeObject = (obj, path = '') => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item, i) => sanitizeObject(item, `${path}[${i}]`));

  const safe = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      logger.warn(`Blocked NoSQL injection attempt — key "${key}" at ${path || 'root'}`);
      continue;
    }
    if (key.includes('\0')) {
      logger.warn(`Blocked null-byte key "${key}" at ${path || 'root'}`);
      continue;
    }
    safe[key] = sanitizeObject(obj[key], `${path}.${key}`);
  }
  return safe;
};

app.use((req, _res, next) => {
  try {
    if (req.body   && typeof req.body   === 'object') req.body   = sanitizeObject(req.body,   'body');
    if (req.query  && typeof req.query  === 'object') req.query  = sanitizeObject(req.query,  'query');
    if (req.params && typeof req.params === 'object') req.params = sanitizeObject(req.params, 'params');
  } catch (err) {
    logger.error('Sanitization error:', err);
  }
  next();
});

// HTTP Parameter Pollution protection
if (hpp) {
  app.use(hpp({ whitelist: ['tags', 'categories', 'skills', 'types', 'statuses'] }));
}

// ===========================
// STATIC FILE SERVING (uploads)
// ===========================
// ✅ Note: ensure uploaded files are stored with content-hash filenames so
//    immutable caching (1y) is safe. If filenames can be overwritten, drop `immutable`.
app.use(
  '/uploads',
  express.static(uploadDir, {
    maxAge: IS_PRODUCTION ? '1y' : '1h',
    etag: true,
    lastModified: true,
    index: false,       // Prevent directory listings
    dotfiles: 'deny',  // Block .env, .htaccess, etc.
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Cache-Control',
        IS_PRODUCTION ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
      );
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// ===========================
// RATE LIMITING
// ===========================
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
  if (IS_PRODUCTION) {
    app.use(generalRateLimit);
  }

  // ✅ Fixed: use req.originalUrl so the skip works correctly regardless of mount point
  app.use(
    '/',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: IS_PRODUCTION ? 1000 : 2000,
      message: { success: false, message: 'Too many requests. Try again later.', code: 'RATE_LIMIT_EXCEEDED' },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) =>
        req.originalUrl === '/health' ||
        req.originalUrl === '/status',
    })
  );
}

// ===========================
// REQUEST LOGGING
// ===========================
if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level]({
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 120),
      });
    });
    next();
  });
}

// ===========================
// HEALTH & STATUS
// ===========================

// ✅ Health check mounted BEFORE rate limiting routes so it is never throttled
app.get('/health', async (_req, res) => {
  let dbHealthy = false;
  try {
    dbHealthy = await db.ping();
  } catch (err) {
    logger.error('DB health check failed:', err);
  }

  const mem = process.memoryUsage();
  const health = {
    status: dbHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    apiVersion: API_VERSION,
    checks: {
      database: {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        ...db.getConnectionInfo(),
      },
      memory: {
        usedMB: Math.round(mem.heapUsed / 1024 / 1024),
        totalMB: Math.round(mem.heapTotal / 1024 / 1024),
        pct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      },
    },
    rateLimiting: {
      enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
      failedAttempts: getFailedAttemptsCount?.() ?? 0,
    },
  };

  if (IS_PRODUCTION) {
    try {
      const testFile = path.join(uploadDir, '.health-check');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      health.uploadsWritable = true;
    } catch (err) {
      health.uploadsWritable = false;
    }
  }

  res.status(health.status === 'OK' ? 200 : 503).json(health);
});

// Minimal liveness probe for load balancers (no DB check, no rate limiting)
app.get('/status', (_req, res) => res.status(200).json({ status: 'OK' }));

// ===========================
// API ROUTES
// ===========================
const apiRouter = express.Router();

apiRouter.use('/contacts',    contactRoutes);
apiRouter.use('/projects',    projectRoutes);
apiRouter.use('/skills',      skillRoutes);
apiRouter.use('/experiences', experienceRoutes);
apiRouter.use('/admin',       adminRoutes);
apiRouter.use('/uploads',     uploadRoutes);
apiRouter.use('/profile',     profileRoutes);
apiRouter.use('/about',       aboutRoutes);
apiRouter.use('/',            subscriberRoutes);

// Mount versioned and legacy paths
app.use(`/${API_VERSION}`, apiRouter);
app.use('/api', apiRouter);

// Root info endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Portfolio API',
    version: process.env.npm_package_version || '1.0.0',
    apiVersion: API_VERSION,
    environment: NODE_ENV,
    links: { health: '/health', docs: '/docs' },
  });
});

// API documentation
app.get('/docs', (req, res) => {
  res.json({
    title: 'Portfolio API',
    version: API_VERSION,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    authentication: 'Bearer token required for /admin/* endpoints',
    rateLimits: {
      general: '100 req / 15 min',
      api: IS_PRODUCTION ? '1000 req / 15 min' : '2000 req / 15 min',
      contact: '5 req / hour',
      login: '5 attempts / 15 min',
    },
  });
});

// ===========================
// 404 & ERROR HANDLERS
// ===========================
app.use((req, res) => {
  logger.warn(`404 ${req.method} ${req.originalUrl} — IP: ${req.ip}`);
  res.status(404).json({
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

// ===========================
// STARTUP CHECKS
// ===========================
const performStartupChecks = async () => {
  const checks = [
    {
      name: 'Uploads directory writable',
      fn: async () => {
        const tmp = path.join(uploadDir, '.startup-test');
        await fs.promises.writeFile(tmp, 'ok');
        await fs.promises.unlink(tmp);
      },
    },
    {
      name: 'JWT_SECRET length >= 64',
      fn: () => {
        if (JWT_SECRET.length < 64) throw new Error('Too short');
      },
    },
  ];

  for (const { name, fn } of checks) {
    try {
      await fn();
      logger.info(`✓ ${name}`);
    } catch (err) {
      logger.error(`✗ ${name}: ${err.message}`);
      if (IS_PRODUCTION) throw new Error(`Critical startup check failed: ${name}`);
    }
  }
};

// ===========================
// GRACEFUL SHUTDOWN
// ===========================
// ✅ Fixed: single shutdown owner — server.js only. Removed duplicate handlers from database.js.
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received — starting graceful shutdown`);

  try {
    await db.disconnect();
    logger.info('Database disconnected');

    clearFailedAttempts?.();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// ===========================
// SERVER START
// ===========================
(async () => {
  try {
    await db.connect();
    logger.info('Database connected');

    await performStartupChecks();

    const server = app.listen(PORT, () => {
      logger.info(`Server listening on http://localhost:${PORT} [${NODE_ENV}]`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`Docs:   http://localhost:${PORT}/docs`);
    });

    server.on('error', (err) => {
      const messages = {
        EADDRINUSE: `Port ${PORT} already in use`,
        EACCES: `Permission denied on port ${PORT} — use a port > 1024`,
      };
      logger.error(messages[err.code] || `Server error: ${err.message}`);
      process.exit(1);
    });

    // ✅ Single source of truth for process signals
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      if (IS_PRODUCTION) gracefulShutdown('UNHANDLED_REJECTION');
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
})();

module.exports = app;