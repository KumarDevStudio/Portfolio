const Joi = require('joi');

const contactValidation = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().max(255).required(),
  subject: Joi.string().min(5).max(200).required(),
  message: Joi.string().min(10).max(2000).required()
});

const projectValidation = Joi.object({
  // Core fields - matching frontend payload exactly
  title: Joi.string().min(3).max(200).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).max(100).required(),

  // Frontend sends 'description' only — shortDescription removed
  description: Joi.string().min(10).max(2000).required(),
  longDescription: Joi.string().allow('').optional(),

  // Frontend sends full category names
category: Joi.string().trim().optional(),


  technologies: Joi.array().items(Joi.string().max(50)).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  features: Joi.array().items(Joi.string().max(500)).optional(),
  challenges: Joi.array().items(Joi.string().max(500)).optional(),

  // URLs
  githubUrl: Joi.string().uri().allow('').optional(),
  liveUrl: Joi.string().uri().allow('').optional(),
  demoUrl: Joi.string().uri().allow('').optional(),

  // Project details
  teamSize: Joi.number().integer().min(1).max(100).optional(),
  myRole: Joi.string().max(200).allow('').optional(),
  clientType: Joi.string()
    .valid('Personal', 'Freelance', 'Company', 'Open Source', 'Academic')
    .optional(),

  // Flags
  featured: Joi.boolean().optional(),
  isArchived: Joi.boolean().optional(),

  // Priority and status
  priority: Joi.number().integer().min(1).max(10).optional(),
  status: Joi.string()
    .valid('planning', 'in-progress', 'completed', 'on-hold')
    .optional(),
  visibility: Joi.string()
    .valid('public', 'private', 'unlisted')
    .optional(),

  // Dates
  startDate: Joi.string().allow('').optional(),
  endDate: Joi.string().allow('').optional(),

  // Duration object
  duration: Joi.object().optional(),

  // SEO
  seo: Joi.object({
    metaTitle: Joi.string().max(200).allow('').optional(),
    metaDescription: Joi.string().max(500).allow('').optional(),
    keywords: Joi.array().items(Joi.string()).optional(),
  }).optional(),

  // Images
  images: Joi.array().items(
    Joi.object({
      filename: Joi.string().optional(),
      originalName: Joi.string().optional(),
      url: Joi.string().optional(),
      size: Joi.number().optional(),
      publicId: Joi.string().optional(),
    })
  ).optional(),

  // Legacy fields (keep for backward compat)
  order: Joi.number().integer().min(0).optional(),

}).options({ allowUnknown: true }); // allow extra fields without breaking


const skillValidation = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.empty': 'Skill name is required',
      'string.min': 'Skill name must be at least 1 character',
      'string.max': 'Skill name cannot exceed 100 characters'
    }),

 category: Joi.string()
  .valid(
    'frontend', 'backend', 'database', 'devops', 'cloud',
    'mobile', 'design', 'tools', 'languages', 'frameworks',
    'libraries', 'desktop', 'testing', 'ai/ml', 'data science',
    'blockchain', 'game development', 'security', 'soft skills', 'other'
  )
  .required()
  .messages({
    'any.only': 'Category must be one of the allowed values',
    'any.required': 'Category is required'
  }),

  level: Joi.string()
    .valid('beginner', 'intermediate', 'advanced', 'expert')
    .required()
    .messages({
      'any.only': 'Level must be one of: beginner, intermediate, advanced, expert',
      'any.required': 'Level is required'
    }),

  proficiency: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required()
    .messages({
      'number.base': 'Proficiency must be a number',
      'number.min': 'Proficiency must be at least 1',
      'number.max': 'Proficiency cannot exceed 100',
      'any.required': 'Proficiency is required'
    }),

  yearsOfExperience: Joi.number()
    .min(0)
    .max(50)
    .optional()
    .messages({
      'number.min': 'Years of experience cannot be negative',
      'number.max': 'Years of experience cannot exceed 50'
    }),
monthsOfExperience: Joi.number().integer().min(0).max(11).default(0),

  description: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),

  icon: Joi.object({
    url: Joi.string().uri().optional(),
    publicId: Joi.string().optional(),
    type: Joi.string().valid('image', 'icon-class', 'svg').default('image')
  }).optional(),

color: Joi.string()
  .allow('')
  .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
  .optional()
  .messages({
    'string.pattern.base': 'Color must be a valid hex color (e.g., #FF5733 or #F57)'
  }),
  
  featured: Joi.boolean()
    .default(false)
    .optional(),

  projects: Joi.array()
    .items(Joi.string().length(24))
    .optional()
    .messages({
      'string.length': 'Invalid project ID format'
    }),

  certifications: Joi.array()
    .items(Joi.object({
      name: Joi.string().required(),
      issuer: Joi.string().required(),
      date: Joi.date().optional(),
      url: Joi.string().uri().optional()
    }))
    .optional(),

  status: Joi.string()
    .valid('active', 'inactive')
    .default('active')
    .optional(),

  order: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional()
});

// Validation for bulk operations
const skillBulkUpdateValidation = Joi.object({
  skillIds: Joi.array()
    .items(Joi.string().length(24))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one skill ID is required',
      'string.length': 'Invalid skill ID format'
    }),

  status: Joi.string()
    .valid('active', 'inactive')
    .required()
});

// Validation for order update
const skillOrderUpdateValidation = Joi.object({
  skills: Joi.array()
    .items(Joi.object({
      id: Joi.string().length(24).required(),
      order: Joi.number().integer().min(0).required()
    }))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one skill is required',
      'string.length': 'Invalid skill ID format'
    })
});

const experienceValidation = Joi.object({
  company: Joi.string().min(2).max(200).required(),
  position: Joi.string().min(2).max(200).required(),
  location: Joi.string().max(200).allow('').optional(),
  description: Joi.string().min(10).max(2000).required(),
  responsibilities: Joi.array().items(Joi.string().max(500)).optional(),
  technologies: Joi.array().items(Joi.string().max(50)).optional(),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null).optional(),
  current: Joi.boolean().optional(),
  isCurrent: Joi.boolean().optional(),  // frontend sends isCurrent
  type: Joi.string()
    .valid('fulltime', 'parttime', 'contract', 'internship', 'freelance')
    .optional(),
  companyUrl: Joi.string().uri().allow('').optional(),
  logo: Joi.object({
    filename: Joi.string().optional(),
    url: Joi.string().optional()
  }).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  order: Joi.number().integer().min(0).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
  isVisible: Joi.boolean().optional(),
  isFeatured: Joi.boolean().optional(),
  companyLogoUrl: Joi.string().allow('').optional(),
}).options({ allowUnknown: true });

const adminValidation = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
    }),
  firstName: Joi.string().max(50).allow(''),
  lastName: Joi.string().max(50).allow(''),
  role: Joi.string().valid('admin', 'superadmin')
});

const loginValidation = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

module.exports = {
  contactValidation,
  projectValidation,
  skillValidation,
  skillBulkUpdateValidation,
  skillOrderUpdateValidation,
  experienceValidation,
  adminValidation,
  loginValidation
};