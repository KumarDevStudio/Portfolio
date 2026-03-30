// ===================================================
// models/Skill.js - Fixed duplicate index
// ===================================================
const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
    // ❌ REMOVED: unique: true - defined in schema.index() instead
  },
  category: {
    type: String,
    required: true,
   enum: [
  'frontend', 'backend', 'database', 'devops', 'cloud',
  'mobile', 'design', 'tools', 'languages', 'frameworks',
  'libraries', 'desktop', 'testing', 'ai/ml', 'data science',
  'blockchain', 'game development', 'security', 'soft skills', 'other'
]
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true
  },
  proficiency: {
    type: Number,
    min: 1,
    max: 100,
    required: true
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  description: {
    type: String,
    maxlength: 500
  },
  icon: {
    url: String,
    publicId: String,
    type: {
      type: String,
      enum: ['image', 'icon-class', 'svg'],
      default: 'image'
    }
  },
  color: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Color must be a valid hex color'
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  certifications: [{
    name: String,
    issuer: String,
    date: Date,
    url: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ===========================
// INDEXES - Define only once here
// ===========================
skillSchema.index({ name: 1 }, { unique: true });
skillSchema.index({ category: 1 });
skillSchema.index({ level: -1 });
skillSchema.index({ featured: -1 });
skillSchema.index({ order: 1 });

module.exports = mongoose.model('Skill', skillSchema);