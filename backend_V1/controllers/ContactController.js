// Fixed: src/controllers/ContactController.js
const Contact = require('../models/Contact');
const { sendContactNotification, sendReplyEmail } = require('../utils/email');

const { contactValidation } = require('../config/validation');
const Joi = require('joi');

class ContactController {
  // Create new contact (Public)
  async create(req, res, next) {
    try {
      const { error } = contactValidation.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false,
          message: 'Validation error', 
          errors: error.details.map(d => d.message) 
        });
      }

      const contactData = {
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        status: 'new'
      };

      const contact = new Contact(contactData);
      await contact.save();

      try {
        await sendContactNotification(contact);
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }

      res.status(201).json({ 
        success: true,
        message: 'Contact form submitted successfully',
        data: { id: contact._id }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all contacts (Admin only)
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 10, status, search } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const query = {};

      if (status && status !== 'all') {
        const validStatuses = ['new', 'read', 'replied', 'archived', 'spam'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid status filter' 
          });
        }
        query.status = status;
      }
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ];
      }

      const contacts = await Contact.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum);

      const total = await Contact.countDocuments(query);
      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        data: {
          contacts,
          pagination: {
            page: pageNum,
            pages: totalPages,
            total,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single contact (Admin only)
  async getById(req, res, next) {
    try {
      const contact = await Contact.findById(req.params.id);
      if (!contact) {
        return res.status(404).json({ 
          success: false,
          message: 'Contact not found' 
        });
      }

      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      next(error);
    }
  }

  // Update contact status (Admin only)
  async updateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const validStatuses = ['new', 'read', 'replied', 'archived', 'spam'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }

      const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
      );

      if (!contact) {
        return res.status(404).json({ 
          success: false,
          message: 'Contact not found' 
        });
      }

      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark contact as read
  async markAsRead(req, res, next) {
    try {
      const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        { status: 'read' },
        { new: true }
      );

      if (!contact) {
        return res.status(404).json({ 
          success: false,
          message: 'Contact not found' 
        });
      }

      res.json({
        success: true,
        data: contact,
        message: 'Contact marked as read'
      });
    } catch (error) {
      next(error);
    }
  }

  // Reply to contact - FIXED VALIDATION
  async reply(req, res, next) {
    try {
      // Validate reply field
      const replySchema = Joi.object({
        reply: Joi.string().trim().min(1).max(5000).required()
      });

      const { error, value } = replySchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({ 
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
      }

      const contact = await Contact.findById(req.params.id);
      
      if (!contact) {
        return res.status(404).json({ 
          success: false,
          message: 'Contact not found' 
        });
      }

      // Update contact status
      contact.status = 'replied';
      contact.replied = true;
      contact.repliedAt = new Date();
      contact.repliedBy = req.admin?._id;
      
      // Add note with reply
      contact.notes.push({
        content: value.reply,
        addedBy: req.admin?._id,
        addedAt: new Date()
      });

      await contact.save();

      // Send reply email
      try {
        await sendReplyEmail(contact.email, contact.name, value.reply);
      } catch (emailError) {
        console.error('Failed to send reply email:', emailError);
      }

      res.json({
        success: true,
        data: contact,
        message: 'Reply sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk operations - FIXED VALIDATION
  async bulkOperation(req, res, next) {
    try {
      const { ids, action, data } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid or empty ids array' 
        });
      }

      const validActions = ['read', 'delete', 'archive', 'spam', 'custom'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
      }

      let updateData = {};
      
      switch (action) {
        case 'read':
          updateData = { status: 'read' };
          break;
        case 'delete':
          const deleteResult = await Contact.deleteMany({ _id: { $in: ids } });
          return res.json({
            success: true,
            message: `${deleteResult.deletedCount} contacts deleted`,
            data: { deletedCount: deleteResult.deletedCount }
          });
        case 'archive':
          updateData = { status: 'archived' };
          break;
        case 'spam':
          updateData = { status: 'spam' };
          break;
        case 'custom':
          if (!data || typeof data !== 'object') {
            return res.status(400).json({ 
              success: false,
              message: 'Custom action requires data object' 
            });
          }
          updateData = data;
          break;
      }

      const result = await Contact.updateMany(
        { _id: { $in: ids } },
        updateData
      );

      res.json({
        success: true,
        message: `${result.modifiedCount} contacts updated`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete contact (Admin only)
  async delete(req, res, next) {
    try {
      const contact = await Contact.findByIdAndDelete(req.params.id);
      if (!contact) {
        return res.status(404).json({ 
          success: false,
          message: 'Contact not found' 
        });
      }

      res.json({ 
        success: true,
        message: 'Contact deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  }

  // Get contact statistics (Admin only)
  async getStats(req, res, next) {
    try {
      const { year, month } = req.query;
      let dateFilter = {};

      if (year && month) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
      } else if (year) {
        const startDate = new Date(parseInt(year), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(parseInt(year) + 1, 0, 1);
        dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
      }

      const stats = await Contact.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await Contact.countDocuments(dateFilter);
      const thisMonthFilter = {};
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);
      thisMonthFilter.createdAt = { $gte: firstOfMonth };
      const thisMonth = await Contact.countDocuments(thisMonthFilter);

      res.json({
        success: true,
        data: {
          total,
          thisMonth,
          byStatus: stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {})
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ContactController();