const Skill = require('../models/Skill');
const { skillValidation } = require('../config/validation');
const { successResponse, errorResponse } = require('../utils/helpers');

class SkillController {
  // Get all active skills (Public)
  async getActive(req, res, next) {
    try {
      const { category } = req.query;
      const query = { status: 'active' };
      
      if (category) {
        query.category = category;
      }

      const skills = await Skill.find(query)
        .select('-__v')
        .sort({ order: 1, category: 1, proficiency: -1 })
        .lean(); // Use lean() for better performance

      // Group by category
      const groupedSkills = skills.reduce((acc, skill) => {
        if (!acc[skill.category]) {
          acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
      }, {});

      // Add category metadata
      const categoriesWithMeta = Object.entries(groupedSkills).map(([category, skills]) => ({
        category,
        count: skills.length,
        skills
      }));

      return successResponse(res, 'Skills retrieved successfully', {
        skills,
        groupedSkills,
        categoriesWithMeta,
        total: skills.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all skills (Admin only)
  async getAll(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        category, 
        status, 
        level,
        featured,
        search,
        sortBy = 'order',
        sortOrder = 'asc'
      } = req.query;
      
      const query = {};

      // Build query filters
      if (category) query.category = category;
      if (status) query.status = status;
      if (level) query.level = level;
      if (featured !== undefined) query.featured = featured === 'true';
      
      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [skills, total] = await Promise.all([
        Skill.find(query)
          .select('-__v')
          .sort(sortObj)
          .limit(limitNum)
          .skip(skip)
          .lean(),
        Skill.countDocuments(query)
      ]);

      return successResponse(res, 'Skills retrieved successfully', {
        skills,
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
      next(error);
    }
  }

  // Get single skill (Admin only)
  async getById(req, res, next) {
    try {
      const skill = await Skill.findById(req.params.id)
        .select('-__v')
        .populate('projects', 'title shortDescription thumbnail')
        .lean();

      if (!skill) {
        return errorResponse(res, 404, 'Skill not found', 'SKILL_NOT_FOUND');
      }

      return successResponse(res, 'Skill retrieved successfully', { skill });
    } catch (error) {
      if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid skill ID format', 'INVALID_ID');
      }
      next(error);
    }
  }

  // Create skill (Admin only)
async create(req, res, next) {
    try {
          console.log("REQ BODY:", req.body);
      // Normalize casing before validation
      if (req.body.category) req.body.category = req.body.category.toLowerCase();
      if (req.body.level)    req.body.level    = req.body.level.toLowerCase();

      const { error, value } = skillValidation.validate(req.body, { abortEarly: false });
      
      if (error) {
        return errorResponse(res, 400, 'Validation failed', 'VALIDATION_ERROR', {
          errors: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

 // 🛡️ Safety check (ADD THIS)
if (!value.name) {
  return errorResponse(res, 400, 'Skill name is required', 'VALIDATION_ERROR');
}

// Check for duplicate name (case-insensitive)
const existingSkill = await Skill.findOne({ 
  name: { $regex: new RegExp(`^${value.name.trim()}$`, 'i') }
});
      if (existingSkill) {
        return errorResponse(res, 409, 'Skill with this name already exists', 'DUPLICATE_SKILL');
      }

      // If no order specified, set it to the highest order + 1
      if (value.order === undefined) {
        const highestOrderSkill = await Skill.findOne()
          .sort({ order: -1 })
          .select('order')
          .lean();
        value.order = highestOrderSkill ? highestOrderSkill.order + 1 : 0;
      }

      const skill = new Skill(value);
      await skill.save();

      return successResponse(res, 'Skill created successfully', { skill }, 201);
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return errorResponse(res, 409, `Skill with this ${field} already exists`, 'DUPLICATE_SKILL');
      }
      next(error);
    }
  }

  // Update skill (Admin only)
async update(req, res, next) {
    try {
      // Normalize casing before validation
      if (req.body.category) req.body.category = req.body.category.toLowerCase();
      if (req.body.level)    req.body.level    = req.body.level.toLowerCase();

      const { error, value } = skillValidation.validate(req.body, { abortEarly: false });
      
      if (error) {
        return errorResponse(res, 400, 'Validation failed', 'VALIDATION_ERROR', {
          errors: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      // Check for duplicate name (excluding current skill)
      if (value.name) {
        const existingSkill = await Skill.findOne({
          name: { $regex: new RegExp(`^${value.name.trim()}$`, 'i') },
          _id: { $ne: req.params.id }
        });

        if (existingSkill) {
          return errorResponse(res, 409, 'Skill with this name already exists', 'DUPLICATE_SKILL');
        }
      }

      const skill = await Skill.findByIdAndUpdate(
        req.params.id,
        { ...value, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).select('-__v');

      if (!skill) {
        return errorResponse(res, 404, 'Skill not found', 'SKILL_NOT_FOUND');
      }

      return successResponse(res, 'Skill updated successfully', { skill });
    } catch (error) {
      if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid skill ID format', 'INVALID_ID');
      }
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return errorResponse(res, 409, `Skill with this ${field} already exists`, 'DUPLICATE_SKILL');
      }
      next(error);
    }
  }

  // Delete skill (Admin only)
  async delete(req, res, next) {
    try {
      const skill = await Skill.findByIdAndDelete(req.params.id);
      
      if (!skill) {
        return errorResponse(res, 404, 'Skill not found', 'SKILL_NOT_FOUND');
      }

      return successResponse(res, 'Skill deleted successfully', {
        deletedSkill: {
          id: skill._id,
          name: skill.name,
          category: skill.category
        }
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid skill ID format', 'INVALID_ID');
      }
      next(error);
    }
  }

  // Get skill categories (Public)
  async getCategories(req, res, next) {
    try {
      const categories = await Skill.distinct('category', { status: 'active' });
      
      // Get detailed stats for each category
      const categoryStats = await Skill.aggregate([
        { $match: { status: 'active' } },
        { 
          $group: { 
            _id: '$category', 
            count: { $sum: 1 },
            avgProficiency: { $avg: '$proficiency' },
            featuredCount: {
              $sum: { $cond: ['$featured', 1, 0] }
            }
          } 
        },
        { $sort: { _id: 1 } }
      ]);

      return successResponse(res, 'Categories retrieved successfully', {
        categories,
        stats: categoryStats.map(stat => ({
          category: stat._id,
          count: stat.count,
          avgProficiency: Math.round(stat.avgProficiency),
          featuredCount: stat.featuredCount
        })),
        total: categories.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Update skill order (Admin only)
  async updateOrder(req, res, next) {
    try {
      const { skills } = req.body;

      if (!Array.isArray(skills) || skills.length === 0) {
        return errorResponse(res, 400, 'Skills array is required and must not be empty', 'INVALID_REQUEST');
      }

      // Validate structure
      const isValid = skills.every(s => s.id && typeof s.order === 'number');
      if (!isValid) {
        return errorResponse(res, 400, 'Each skill must have id and order properties', 'INVALID_REQUEST');
      }

      // Validate all IDs exist before updating
      const skillIds = skills.map(s => s.id);
      const existingSkills = await Skill.find({ _id: { $in: skillIds } }).select('_id');

      if (existingSkills.length !== skills.length) {
        return errorResponse(res, 404, 'One or more skills not found', 'SKILLS_NOT_FOUND');
      }

      // Perform bulk update
      const bulkOps = skills.map(({ id, order }) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order, updatedAt: Date.now() } }
        }
      }));

      const result = await Skill.bulkWrite(bulkOps);

      return successResponse(res, 'Skill order updated successfully', {
        updatedCount: result.modifiedCount,
        totalRequested: skills.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update status (Admin only)
  async bulkUpdateStatus(req, res, next) {
    try {
      const { skillIds, status } = req.body;

      if (!Array.isArray(skillIds) || skillIds.length === 0) {
        return errorResponse(res, 400, 'Skill IDs array is required and must not be empty', 'INVALID_REQUEST');
      }

      if (!['active', 'inactive'].includes(status)) {
        return errorResponse(res, 400, 'Status must be either "active" or "inactive"', 'INVALID_STATUS');
      }

      const result = await Skill.updateMany(
        { _id: { $in: skillIds } },
        { 
          $set: { 
            status,
            updatedAt: Date.now()
          } 
        }
      );

      return successResponse(res, 'Skills status updated successfully', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        status: status
      });
    } catch (error) {
      next(error);
    }
  }

  // Get skill statistics (Admin only)
  async getStatistics(req, res, next) {
    try {
      const [
        totalSkills,
        activeSkills,
        skillsByCategory,
        skillsByLevel,
        featuredSkills,
        avgProficiency
      ] = await Promise.all([
        Skill.countDocuments(),
        Skill.countDocuments({ status: 'active' }),
        Skill.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Skill.aggregate([
          { $group: { _id: '$level', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Skill.countDocuments({ featured: true, status: 'active' }),
        Skill.aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: null, avg: { $avg: '$proficiency' } } }
        ])
      ]);

      return successResponse(res, 'Statistics retrieved successfully', {
        overview: {
          total: totalSkills,
          active: activeSkills,
          inactive: totalSkills - activeSkills,
          featured: featuredSkills,
          avgProficiency: avgProficiency[0]?.avg ? Math.round(avgProficiency[0].avg) : 0
        },
        byCategory: skillsByCategory.map(cat => ({
          category: cat._id,
          count: cat.count,
          percentage: Math.round((cat.count / totalSkills) * 100)
        })),
        byLevel: skillsByLevel.map(level => ({
          level: level._id,
          count: level.count,
          percentage: Math.round((level.count / totalSkills) * 100)
        }))
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SkillController();