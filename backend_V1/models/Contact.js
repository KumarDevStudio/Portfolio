// Updated: src/models/Contact.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^\+?[\d\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  company: {
    type: String,
    trim: true,
    maxlength: 200
  },
  projectType: {
    type: String,
    enum: ['web-development', 'mobile-app', 'consultation', 'other'],
    default: 'other'
  },
  budget: {
    type: String,
    enum: ['under-5k', '5k-10k', '10k-25k', '25k-50k', 'above-50k', 'not-sure']
  },
  timeline: {
    type: String,
    enum: ['asap', '1-month', '2-3-months', '3-6-months', 'flexible']
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'archived', 'spam'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  source: {
    type: String,
    enum: ['website', 'linkedin', 'github', 'referral', 'other'],
    default: 'website'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  replied: {
    type: Boolean,
    default: false
  },
  repliedAt: {
    type: Date
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  notes: [{
    content: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ priority: -1 });

module.exports = mongoose.model('Contact', contactSchema);