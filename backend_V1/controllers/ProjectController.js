const Project = require('../models/Project');
const { projectValidation } = require('../config/validation');
const { deleteUploadedFiles } = require('../utils/helpers');
const cloudinary = require('../config/cloudinary'); // ← add this line
      const fs = require('fs');

class ProjectController {
  // Get all published projects (Public)
  async getPublished(req, res, next) {
    try {
      const { category, featured, limit = 50 } = req.query;
const query = {
  status: { $in: ['published', 'completed', 'planning', 'in-progress', 'maintenance'] }
};
      if (category) query.category = category;
      if (featured) query.featured = featured === 'true';

      const maxLimit = 100;
      const sanitizedLimit = Math.min(parseInt(limit) || 50, maxLimit);

      const projects = await Project.find(query)
        .sort({ featured: -1, order: -1, createdAt: -1 })
        .limit(sanitizedLimit);

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single published project (Public)
  async getPublishedById(req, res, next) {
    try {
      const project = await Project.findOne({
        _id: req.params.id,
        status: 'published'
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all projects (Admin only)
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 10, status, category, search } = req.query;
      const query = {};

      if (status) query.status = status;
      if (category) query.category = category;

      if (search) {
        const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { title: { $regex: sanitizedSearch, $options: 'i' } },
          { description: { $regex: sanitizedSearch, $options: 'i' } }
        ];
      }

      // Raised to 1000 to match frontend fetch of ?limit=1000
      const maxLimit = 1000;
      const sanitizedLimit = Math.min(parseInt(limit) || 10, maxLimit);
      const sanitizedPage = Math.max(parseInt(page) || 1, 1);

      const projects = await Project.find(query)
        .sort({ order: -1, createdAt: -1 })
        .limit(sanitizedLimit)
        .skip((sanitizedPage - 1) * sanitizedLimit);

      const total = await Project.countDocuments(query);

      res.json({
        success: true,
        data: projects,
        pagination: {
          total,
          page: sanitizedPage,
          limit: sanitizedLimit,
          pages: Math.ceil(total / sanitizedLimit),
          hasNext: sanitizedPage < Math.ceil(total / sanitizedLimit),
          hasPrev: sanitizedPage > 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single project (Admin only)
  async getById(req, res, next) {
    try {
      const project = await Project.findById(req.params.id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      next(error);
    }
  }

  // Create project (Admin only)
  async create(req, res, next) {
    try {
      const { error } = projectValidation.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      const project = new Project(req.body);
      await project.save();

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Project already exists',
          error: 'A project with this identifier already exists'
        });
      }
      next(error);
    }
  }

  // Update project (Admin only)
  async update(req, res, next) {
    try {
      const { error } = projectValidation.validate(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        });
      }

      const project = await Project.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: project
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Update failed',
          error: 'A project with this identifier already exists'
        });
      }
      next(error);
    }
  }

  // Delete project (Admin only)
  async delete(req, res, next) {
    try {
      const project = await Project.findById(req.params.id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      if (project.images && project.images.length > 0) {
        const filenames = project.images.map(img => img.filename);
        try {
          await deleteUploadedFiles(filenames);
        } catch (fileError) {
          console.error('Error deleting files:', fileError);
          // Continue with deletion even if file cleanup fails
        }
      }

      await Project.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Project deleted successfully',
        deletedId: req.params.id
      });
    } catch (error) {
      next(error);
    }
  }



  // Get project categories (Public)
  async getCategories(req, res, next) {
    try {
      const categories = await Project.distinct('category', {
        status: 'published'
      });

      res.json({
        success: true,
        data: {
          categories: categories.filter(Boolean).sort()
        }
      });
    } catch (error) {
      next(error);
    }
  }


// Upload project images (Admin only)
  async uploadImages(req, res, next) {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No images provided' });
      }


      const uploadedImages = await Promise.all(
        req.files.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'projects',
            resource_type: 'image',
          });
          fs.unlink(file.path, () => {}); // clean up temp file
          return {
            filename: result.public_id,
            originalName: file.originalname,
            url: result.secure_url,
            publicId: result.public_id,
            size: file.size,
          };
        })
      );

      project.images = [...(project.images || []), ...uploadedImages];
      await project.save();

      res.json({
        success: true,
        message: 'Images uploaded successfully',
        data: project,
      });
    } catch (error) {
      // Clean up any temp files on error
      if (req.files?.length > 0) {
        const fs = require('fs');
        req.files.forEach(f => fs.unlink(f.path, () => {}));
      }
      next(error);
    }
  }

  // Delete single project image (Admin only)
  async deleteImage(req, res, next) {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      const { publicId } = req.params;
      const decodedPublicId = decodeURIComponent(publicId);

      const imageExists = project.images.some(img => img.publicId === decodedPublicId);
      if (!imageExists) {
        return res.status(404).json({ success: false, message: 'Image not found' });
      }

      // Delete from Cloudinary
      try {
        const cloudinary = require('cloudinary').v2;
        await cloudinary.uploader.destroy(decodedPublicId);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue even if Cloudinary delete fails
      }

      project.images = project.images.filter(img => img.publicId !== decodedPublicId);
      await project.save();

      res.json({
        success: true,
        message: 'Image deleted successfully',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }






  // Get project statistics (Admin only)
  async getStats(req, res, next) {
    try {
      const [total, published, draft, featured, byCategory] = await Promise.all([
        Project.countDocuments(),
        Project.countDocuments({ status: 'published' }),
        Project.countDocuments({ status: 'draft' }),
        Project.countDocuments({ featured: true }),
        Project.aggregate([
          { $match: { status: 'published' } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          total,
          published,
          draft,
          featured,
          byCategory: byCategory.reduce((acc, cat) => {
            if (cat._id) {
              acc[cat._id] = cat.count;
            }
            return acc;
          }, {})
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProjectController();