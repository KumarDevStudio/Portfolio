// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// User Roles
const USER_ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'superadmin'
};

// Project Categories
const PROJECT_CATEGORIES = {
  WEB: 'web',
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
  API: 'api',
  OTHER: 'other'
};

// Project Status
const PROJECT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

// Skill Categories
const SKILL_CATEGORIES = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DATABASE: 'database',
  TOOL: 'tool',
  LANGUAGE: 'language',
  FRAMEWORK: 'framework',
  OTHER: 'other'
};

// Contact Status
const CONTACT_STATUS = {
  NEW: 'new',
  READ: 'read',
  REPLIED: 'replied',
  ARCHIVED: 'archived'
};

// Experience Types
const EXPERIENCE_TYPES = {
  FULL_TIME: 'fulltime',
  PART_TIME: 'parttime',
  CONTRACT: 'contract',
  INTERNSHIP: 'internship',
  FREELANCE: 'freelance'
};

// File Types
const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// Rate Limiting
const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  },
  CONTACT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5
  },
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5
  }
};

// Pagination
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// JWT
const JWT = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d'
};

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  PROJECT_CATEGORIES,
  PROJECT_STATUS,
  SKILL_CATEGORIES,
  CONTACT_STATUS,
  EXPERIENCE_TYPES,
  ALLOWED_FILE_TYPES,
  RATE_LIMITS,
  PAGINATION,
  JWT
};