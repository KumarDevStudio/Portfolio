const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

// Store for tracking failed attempts per user (in production, use Redis)
const failedAttempts = new Map();

// Safe key generator for login (IPv6 + username)
const loginKeyGenerator = (req) => {
  const ip = ipKeyGenerator(req); // ✅ normalize IPv6
  const username = req.body?.username || "unknown";
  return `${ip}:${username}`;
};

// General rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ["/api/health", "/health", "/status", "/ping"].includes(req.path),
  handler: (req, res) => {
    console.log(
      `General rate limit exceeded - IP: ${req.ip}, Path: ${req.path}, UA: ${req.get("User-Agent")}`
    );
    res.status(429).json({
      success: false,
      error: "Too many requests from this IP",
      retryAfter: Math.ceil(15 * 60),
    });
  },
});

// Contact form rate limiting
const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(
      `Contact rate limit exceeded - IP: ${req.ip}, Email: ${req.body?.email || "N/A"}`
    );
    res.status(429).json({
      success: false,
      error: "Too many contact submissions from this IP. Please try again later.",
      retryAfter: Math.ceil(60 * 60),
    });
  },
});

// Login attempts rate limiting
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: loginKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const remainingTime = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    const key = loginKeyGenerator(req);

    // Track failed attempts
    const entry = failedAttempts.get(key) || { count: 0, last: Date.now() };
    entry.count++;
    entry.last = Date.now();
    failedAttempts.set(key, entry);

    res.status(429).json({
      success: false,
      error: "Too many login attempts. Please try again later.",
      retryAfter: remainingTime,
      blockedUntil: new Date(req.rateLimit.resetTime).toISOString(),
    });
  },
});

// Strict rate limiting
const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === 'development' ? 1000 : 20, // ✅ Increased from 3 to 20
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.adminId || ipKeyGenerator(req),
  handler: (req, res) => {
    const timeRemaining = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60);
    console.log(
      `Strict rate limit exceeded - IP: ${req.ip}, Path: ${req.path}, Admin: ${req.admin?.adminId || "N/A"}`
    );
    res.status(429).json({
      success: false,
      error: "Too many attempts for this sensitive operation. Please try again later.",
      retryAfter: timeRemaining * 60,
      code: 'RATE_LIMIT_EXCEEDED'
    });
  },
});

// Admin-specific rate limiting
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => req.admin?.adminId || ipKeyGenerator(req),
  skip: (req) => !req.path.startsWith("/api/admin"),
  standardHeaders: true,
  legacyHeaders: false,
});

// Factory for API rate limiters
const createAPIRateLimit = (windowMs, max, message = "Rate limit exceeded") =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      }),
  });

// Other specific limiters (uploads, password change, refresh, account creation)
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === 'development' ? 1000 : 30, // ✅ Increased from 10 to 30
  skipSuccessfulRequests: true, // ✅ Critical - only count failures
  keyGenerator: (req) => req.admin?.adminId || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const timeRemaining = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60);
    console.log(
      `Upload rate limit exceeded - IP: ${req.ip}, Path: ${req.path}, Admin: ${req.admin?.adminId || "N/A"}`
    );
    res.status(429).json({
      success: false,
      error: "Too many file uploads. Please try again later.",
      retryAfter: timeRemaining * 60,
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
    });
  }
});

const passwordChangeRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => req.admin?.adminId || ipKeyGenerator(req),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});
const refreshTokenRateLimit = createAPIRateLimit(60 * 1000, 10, "Too many token refresh attempts");
const accountCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.admin?.adminId || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
});

// Cleanup old failed attempts every hour
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let cleaned = 0;
  for (const [key, entry] of failedAttempts.entries()) {
    if (entry.last < cutoff) {
      failedAttempts.delete(key);
      cleaned++;
    }
  }
  if (cleaned) console.log(`Cleaned up ${cleaned} old failed attempt entries`);
}, 60 * 60 * 1000);

module.exports = {
  generalRateLimit,
  contactRateLimit,
  loginRateLimit,
  strictRateLimit,
  adminRateLimit,
  uploadRateLimit,
  passwordChangeRateLimit,
  refreshTokenRateLimit,
  accountCreationRateLimit,
  createAPIRateLimit,
  getFailedAttemptsCount: () => failedAttempts.size,
  clearFailedAttempts: () => failedAttempts.clear(),
};
