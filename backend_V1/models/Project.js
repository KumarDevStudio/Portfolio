// ===================================================
// models/Project.js - Updated to match frontend payload
// ===================================================
const mongoose = require('mongoose');
const Subscriber = require('./Subscriber');
const { sendProjectNotification } = require('../utils/email');
const { logger } = require('../utils/helpers');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000  // increased from 1000 to match validation.js
  },
  longDescription: {
    type: String,
    maxlength: 10000  // increased for detailed descriptions
  },
  shortDescription: {
    type: String,
    maxlength: 200
  },
  technologies: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  features: [{
    type: String,
    trim: true
  }],
  challenges: [{
    type: String,
    trim: true
  }],

  // ✅ FIXED: enum values now match frontend exactly
  category: {
    type: String,
    trim: true,
    default: 'Other'
  },

  // ✅ FIXED: merged all status values frontend + legacy
  status: {
    type: String,
    enum: ['planning', 'in-progress', 'completed', 'on-hold', 'maintenance', 'draft', 'published', 'archived'],
    default: 'completed'
  },

  // ✅ FIXED: added 'unlisted' to match frontend
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted', 'draft'],
    default: 'public'
  },

  featured: {
    type: Boolean,
    default: false
  },

  isArchived: {
    type: Boolean,
    default: false
  },

  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },

  // URLs
  liveUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Live URL must be a valid URL'
    }
  },
  githubUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);  // relaxed - allows any URL not just github
      },
      message: 'GitHub URL must be a valid URL'
    }
  },
  demoUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Demo URL must be a valid URL'
    }
  },

  // Project details
  teamSize: {
    type: Number,
    min: 1,
    max: 100,
    default: 1
  },
  myRole: {
    type: String,
    trim: true,
    maxlength: 200
  },
  clientType: {
    type: String,
    enum: ['Personal', 'Freelance', 'Company', 'Open Source', 'Academic'],
    default: 'Personal'
  },

  // Dates
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  duration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Images
  images: [{
    filename: String,
    originalName: String,
    url: String,
    publicId: String,
    size: Number,
    alt: String,
    order: Number
  }],

  // SEO
  seo: {
    metaTitle: {
      type: String,
      maxlength: 200
    },
    metaDescription: {
      type: String,
      maxlength: 500
    },
    keywords: [String]
  },

  // Metrics
  metrics: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
  },

  // Display
  order: {
    type: Number,
    default: 0
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===========================
// INDEXES
// ===========================
projectSchema.index({ slug: 1 }, { unique: true, sparse: true });
projectSchema.index({ title: 'text', description: 'text', technologies: 'text' });
projectSchema.index({ featured: -1, createdAt: -1 });
projectSchema.index({ status: 1, visibility: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ technologies: 1 });
projectSchema.index({ isArchived: 1 });
projectSchema.index({ priority: -1 });

// ===========================
// VIRTUALS
// ===========================
projectSchema.virtual('url').get(function() {
  return `/projects/${this.slug}`;
});

// ===========================
// PRE-SAVE MIDDLEWARE
// ===========================
projectSchema.pre('save', function(next) {
  // Track whether this is a new document for post-save hook
  this.wasNew = this.isNew;

  // Auto-generate slug from title if not provided
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Pre-update middleware to handle slug on update
projectSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.title && !update.slug) {
    update.slug = update.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// ===========================
// POST-SAVE MIDDLEWARE
// ===========================

// Notify all active subscribers when a new project is saved
projectSchema.post('save', async function(doc) {
  // Only fire for brand-new projects, not updates
  if (!this.wasNew) return;

  // Only notify if project is publicly visible
  if (doc.visibility !== 'public' || doc.isArchived) return;

  try {
    const subscribers = await Subscriber.find({ isActive: true }).select('email');

    if (subscribers.length === 0) {
      logger.info(`Project "${doc.title}" saved — no active subscribers to notify.`);
      return;
    }

    const result = await sendProjectNotification(doc, subscribers);
    logger.info(`Project "${doc.title}" — subscriber emails: Sent ${result.sent}, Failed ${result.failed}`);
  } catch (err) {
    // Never crash the save — email failure is non-critical
    logger.error(`Post-save notification failed for project "${doc.title}":`, err.message);
  }
});

module.exports = mongoose.model('Project', projectSchema);