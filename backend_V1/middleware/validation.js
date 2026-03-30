// middleware/validation.js
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');
const mongoose = require('mongoose');

const validateObjectId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError('Invalid ID format', HTTP_STATUS.BAD_REQUEST));
  }
  next();
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path ?? error.param,
      message: error.msg,
      value: error.value
    }));
    
    return next(new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, formattedErrors));
  }
  
  next();
};

module.exports = {
  handleValidationErrors,
  validateObjectId  // <-- was missing entirely
};