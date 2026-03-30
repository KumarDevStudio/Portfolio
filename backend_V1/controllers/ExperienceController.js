const Experience = require('../models/Experience');
const { experienceValidation } = require('../config/validation');
const { deleteUploadedFiles, logger, successResponse, errorResponse } = require('../utils/helpers');

// ─── helper: parse a comma/JSON array field from FormData ────────────────────
const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];

  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed)
        ? parsed.map((v) => String(v).trim()).filter(Boolean)
        : [str];
    } catch (_) { /* fall through to comma split */ }
  }

  return str.split(',').map((v) => v.trim()).filter(Boolean);
};

// ─── helper: map frontend boolean-as-string values from FormData ─────────────
const parseBool = (value) => {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === true;
};

// ─── helper: map frontend field names → backend field names ─────────────────
const normaliseBody = (raw) => {
  const body = { ...raw };

  // FIX: remove empty _id to avoid CastError on create
  if ('_id' in body && (!body._id || body._id === '')) {
    delete body._id;
  }

  // FIX: convert empty string dates → null/undefined before Joi validation.
  // FormData always sends empty fields as "" which Joi rejects as invalid date.
  if (!body.endDate || body.endDate === '') body.endDate = null;
  if (!body.startDate || body.startDate === '') body.startDate = undefined;

  // isCurrent → current
  if ('isCurrent' in body) {
    body.current = parseBool(body.isCurrent);
    delete body.isCurrent;
  }

  // isFeatured → featured
  if ('isFeatured' in body) {
    body.featured = parseBool(body.isFeatured);
    delete body.isFeatured;
  }

  // isVisible → status ('active' | 'inactive')
  if ('isVisible' in body) {
    body.status = parseBool(body.isVisible) ? 'active' : 'inactive';
    delete body.isVisible;
  }

  // displayOrder → order
  if ('displayOrder' in body) {
    body.order = Number(body.displayOrder) || 0;
    delete body.displayOrder;
  }

  // Parse array fields that arrive as JSON strings or comma-separated values
  ['responsibilities', 'technologies', 'achievements', 'tags'].forEach((field) => {
    if (field in body) body[field] = parseArrayField(body[field]);
  });

  // Parse remaining booleans that might arrive as strings from FormData
  ['current', 'featured'].forEach((field) => {
    if (field in body) body[field] = parseBool(body[field]);
  });

  // FIX: if current=true, force endDate to null regardless of what the form sent.
  // Handles the case where a stale endDate value slips through before clearing.
  if (body.current) body.endDate = null;

  return body;
};

class ExperienceController {
  // ─── Public: Get all active experiences ──────────────────────────────────
  async getActive(req, res, next) {
    try {
      const { type, current, featured } = req.query;
      const query = { status: 'active' };

      if (type) query.type = type;
      if (current !== undefined) query.current = current === 'true';
      if (featured !== undefined) query.featured = featured === 'true';

      const experiences = await Experience.find(query)
        .sort({ current: -1, endDate: -1, startDate: -1 })
        .select('-status -order -__v')
        .lean();

      let groupedExperiences = {};
      if (!type) {
        groupedExperiences = experiences.reduce((acc, exp) => {
          if (!acc[exp.type]) acc[exp.type] = [];
          acc[exp.type].push(exp);
          return acc;
        }, {});
      }

      return successResponse(res, 'Experiences retrieved successfully', {
        experiences,
        ...(Object.keys(groupedExperiences).length > 0 && { grouped: groupedExperiences }),
        total: experiences.length
      });
    } catch (error) {
      logger.error('Get active experiences error:', error);
      next(error);
    }
  }

  // ─── Admin: Get all experiences (paginated) ───────────────────────────────
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        current,
        search,
        sortBy = 'startDate',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, Math.min(50, parseInt(limit) || 10));

      const query = {};
      if (status) query.status = status;
      if (type) query.type = type;
      if (current !== undefined) query.current = current === 'true';
      if (search) {
        query.$or = [
          { company: { $regex: search, $options: 'i' } },
          { position: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } }
        ];
      }

      const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const [experiences, total] = await Promise.all([
        Experience.find(query)
          .select('-__v')
          .sort(sortOptions)
          .limit(limitNum)
          .skip((pageNum - 1) * limitNum)
          .lean(),
        Experience.countDocuments(query)
      ]);

      return successResponse(res, 'Experiences retrieved successfully', {
        experiences,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      logger.error('Get all experiences error:', error);
      next(error);
    }
  }

  // ─── Admin: Get single experience ────────────────────────────────────────
  async getById(req, res, next) {
    try {
      const experience = await Experience.findById(req.params.id).select('-__v');

      if (!experience) {
        return errorResponse(res, 404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
      }

      return successResponse(res, 'Experience retrieved successfully', { experience });
    } catch (error) {
      if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid experience ID format', 'INVALID_ID_FORMAT');
      }
      logger.error('Get experience by ID error:', error);
      next(error);
    }
  }

  // ─── Admin: Create experience ─────────────────────────────────────────────
  async create(req, res, next) {
    try {
      const rawBody = normaliseBody(req.body);

      const { error, value } = experienceValidation.validate(rawBody, { abortEarly: false });

      if (error) {
        if (req.file) {
          await deleteUploadedFiles([req.file.filename]).catch((e) =>
            logger.warn('Failed to clean up logo after validation error:', e)
          );
        }
        return errorResponse(res, 400, 'Validation failed', 'VALIDATION_ERROR', {
          errors: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      if (req.file) {
        // FIX: consistent fallback URL (same as update)
        value.logo = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          url: req.file.location || req.file.path || `${process.env.BASE_URL || ''}/uploads/${req.file.filename}`,
          publicId: req.file.publicId || req.file.key || '',
          size: req.file.size
        };
      }

      if (value.current) value.endDate = null;

      if (!value.current && value.startDate && value.endDate) {
        if (new Date(value.startDate) >= new Date(value.endDate)) {
          return errorResponse(res, 400, 'End date must be after start date', 'INVALID_DATE_RANGE');
        }
      }

      const experience = new Experience(value);
      await experience.save();

      logger.info(
        `Experience created: ${experience.position} at ${experience.company} ` +
        `by admin: ${req.admin?.username || 'unknown'}`
      );

      return successResponse(res, 'Experience created successfully', { experience }, 201);
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return errorResponse(res, 409, `${field} already exists`, 'DUPLICATE_FIELD');
      }
      logger.error('Create experience error:', error);
      next(error);
    }
  }

  // ─── Admin: Update experience ─────────────────────────────────────────────
  async update(req, res, next) {
    try {
      const rawBody = normaliseBody(req.body);

      const { error, value } = experienceValidation.validate(rawBody, { abortEarly: false });

      if (error) {
        if (req.file) {
          await deleteUploadedFiles([req.file.filename]).catch((e) =>
            logger.warn('Failed to clean up logo after validation error:', e)
          );
        }
        return errorResponse(res, 400, 'Validation failed', 'VALIDATION_ERROR', {
          errors: error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      if (req.file) {
        const existing = await Experience.findById(req.params.id).select('logo');
        if (existing?.logo?.filename) {
          await deleteUploadedFiles([existing.logo.filename]).catch((e) =>
            logger.warn('Failed to delete old logo on update:', e)
          );
        }

        // FIX: consistent fallback URL (matches create)
        value.logo = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          url: req.file.location || req.file.path || `${process.env.BASE_URL || ''}/uploads/${req.file.filename}`,
          publicId: req.file.publicId || req.file.key || '',
          size: req.file.size
        };
      }

      if (value.current) value.endDate = null;

      if (!value.current && value.startDate && value.endDate) {
        if (new Date(value.startDate) >= new Date(value.endDate)) {
          return errorResponse(res, 400, 'End date must be after start date', 'INVALID_DATE_RANGE');
        }
      }

      const experience = await Experience.findByIdAndUpdate(
        req.params.id,
        value,
        { new: true, runValidators: true }
      ).select('-__v');

      if (!experience) {
        return errorResponse(res, 404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
      }

      logger.info(
        `Experience updated: ${experience._id} by admin: ${req.admin?.username || 'unknown'}`
      );

      return successResponse(res, 'Experience updated successfully', { experience });
    } catch (error) {
      if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid experience ID format', 'INVALID_ID_FORMAT');
      }
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return errorResponse(res, 409, `${field} already exists`, 'DUPLICATE_FIELD');
      }
      logger.error('Update experience error:', error);
      next(error);
    }
  }

  // ─── Admin: Delete experience ─────────────────────────────────────────────
  async delete(req, res, next) {
    try {
      const experience = await Experience.findById(req.params.id);

      if (!experience) {
        return errorResponse(res, 404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
      }

      if (experience.logo?.filename) {
        await deleteUploadedFiles([experience.logo.filename]).catch((e) =>
          logger.warn(`Failed to delete logo file: ${experience.logo.filename}`, e)
        );
      }

      await Experience.findByIdAndDelete(req.params.id);

      logger.info(
        `Experience deleted: ${experience.position} at ${experience.company} ` +
        `by admin: ${req.admin?.username || 'unknown'}`
      );

      return successResponse(res, 'Experience deleted successfully', {
        deletedExperience: {
          id: experience._id,
          company: experience.company,
          position: experience.position
        }
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid experience ID format', 'INVALID_ID_FORMAT');
      }
      logger.error('Delete experience error:', error);
      next(error);
    }
  }

  // ─── Admin: Update display order ──────────────────────────────────────────
  async updateOrder(req, res, next) {
    try {
      const { experiences } = req.body;

      if (!Array.isArray(experiences) || experiences.length === 0) {
        return errorResponse(res, 400, 'Experiences array is required', 'MISSING_EXPERIENCES_ARRAY');
      }

      const invalidItems = experiences.filter(
        (exp) => !exp.id || typeof exp.order !== 'number'
      );
      if (invalidItems.length > 0) {
        return errorResponse(
          res, 400,
          'Each experience must have id and order fields',
          'INVALID_STRUCTURE'
        );
      }

      const ids = experiences.map((exp) => exp.id);
      const existingExperiences = await Experience.find({ _id: { $in: ids } });

      if (existingExperiences.length !== experiences.length) {
        return errorResponse(
          res, 404,
          'One or more experience IDs not found',
          'INVALID_EXPERIENCE_IDS'
        );
      }

      // FIX: single atomic bulkWrite instead of N separate findByIdAndUpdate calls
      await Experience.bulkWrite(
        experiences.map(({ id, order }) => ({
          updateOne: {
            filter: { _id: id },
            update: { $set: { order } }
          }
        }))
      );

      logger.info(
        `Experience order updated for ${experiences.length} items ` +
        `by admin: ${req.admin?.username || 'unknown'}`
      );

      return successResponse(res, 'Experience order updated successfully', {
        updatedCount: experiences.length
      });
    } catch (error) {
      logger.error('Update experience order error:', error);
      next(error);
    }
  }

  // ─── Public/Admin: Get by date range ─────────────────────────────────────
  async getByDateRange(req, res, next) {
    try {
      const { startDate, endDate, type } = req.query;

      if (!startDate || !endDate) {
        return errorResponse(res, 400, 'Start date and end date are required', 'MISSING_DATE_RANGE');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return errorResponse(res, 400, 'Invalid date format', 'INVALID_DATE_FORMAT');
      }

      if (start > end) {
        return errorResponse(res, 400, 'Start date cannot be after end date', 'INVALID_DATE_RANGE');
      }

      const query = {
        status: 'active',
        $or: [
          { startDate: { $gte: start, $lte: end } },
          { endDate: { $gte: start, $lte: end } },
          { startDate: { $lte: start }, endDate: { $gte: end } },
          { startDate: { $lte: end }, current: true }
        ]
      };

      if (type) query.type = type;

      const experiences = await Experience.find(query)
        .select('-__v -status')
        .sort({ startDate: -1 })
        .lean();

      return successResponse(res, 'Experiences by date range retrieved successfully', {
        experiences,
        dateRange: { startDate: start.toISOString(), endDate: end.toISOString() },
        total: experiences.length
      });
    } catch (error) {
      logger.error('Get experiences by date range error:', error);
      next(error);
    }
  }

  // ─── Admin: Statistics ───────────────────────────────────────────────────
  async getStats(req, res, next) {
    try {
      const [total, active, inactive, current, byType, recent] =
        await Promise.all([
          Experience.countDocuments(),
          Experience.countDocuments({ status: 'active' }),
          Experience.countDocuments({ status: 'inactive' }),
          Experience.countDocuments({ current: true, status: 'active' }),
          // FIX: was grouping on '$workType' which doesn't exist — use '$type'
          Experience.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]),
          Experience.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          })
        ]);

      const completedExperiences = await Experience.find({
        status: 'active',
        startDate: { $exists: true },
        endDate: { $exists: true, $ne: null }
      }).select('startDate endDate');

      let averageDuration = 0;
      if (completedExperiences.length > 0) {
        const totalDuration = completedExperiences.reduce((acc, exp) => {
          return acc + (new Date(exp.endDate) - new Date(exp.startDate));
        }, 0);
        averageDuration = Math.round(
          totalDuration / completedExperiences.length / (1000 * 60 * 60 * 24 * 30)
        );
      }

      return successResponse(res, 'Experience statistics retrieved successfully', {
        total,
        active,
        inactive,
        current,
        completed: completedExperiences.length,
        recentlyAdded: recent,
        averageDurationMonths: averageDuration,
        // FIX: removed duplicate byWorkType — byType covers employment type breakdown
        byType: byType.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Get experience stats error:', error);
      next(error);
    }
  }
}

module.exports = new ExperienceController();