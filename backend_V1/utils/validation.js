const Joi = require('joi');

// Custom validation functions
const validateObjectId = (value, helpers) => {
  if (!/^[0-9a-fA-F]{24}$/.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const validateUrl = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch {
    return helpers.error('any.invalid');
  }
};

// Extended Joi with custom validators
const extendedJoi = Joi.extend(
  {
    type: 'objectId',
    base: Joi.string(),
    validate: validateObjectId
  },
  {
    type: 'url',
    base: Joi.string(),
    validate: validateUrl
  }
);

// Common validation schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().valid('asc', 'desc').default('desc'),
  sortBy: Joi.string().default('createdAt')
});

const idParamSchema = Joi.object({
  id: extendedJoi.objectId().required()
});

module.exports = {
  extendedJoi,
  paginationSchema,
  idParamSchema,
  validateObjectId,
  validateUrl
};