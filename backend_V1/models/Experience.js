const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters'],
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },

  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true,
    minlength: [2, 'Position must be at least 2 characters'],
    maxlength: [200, 'Position cannot exceed 200 characters']
  },

  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters'],
    default: ''
  },

  // Employment kind: fulltime, parttime, contract, internship, freelance
  type: {
    type: String,
    enum: {
      values: ['fulltime', 'parttime', 'contract', 'internship', 'freelance'],
      message: '{VALUE} is not a valid employment type'
    },
    required: [true, 'Employment type is required']
  },

  // Work arrangement: onsite, remote, hybrid
  workType: {
    type: String,
    enum: {
      values: ['onsite', 'remote', 'hybrid'],
      message: '{VALUE} is not a valid work type'
    },
    default: 'onsite'
  },

  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },

  endDate: {
    type: Date,
    default: null,
    validate: {
      validator: function (value) {
        if (!value) return true;
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },

  // FIX: single canonical field name — "current" (not isCurrent)
  current: {
    type: Boolean,
    default: false
  },

  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  responsibilities: [{
    type: String,
    trim: true,
    maxlength: [500, 'Responsibility cannot exceed 500 characters']
  }],

  achievements: [{
    type: String,
    trim: true,
    maxlength: [500, 'Achievement cannot exceed 500 characters']
  }],

  technologies: [{
    type: String,
    trim: true,
    maxlength: [50, 'Technology name cannot exceed 50 characters']
  }],

  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  projects: [{
    name: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    technologies: [{ type: String, trim: true }],
    url: {
      type: String,
      validate: {
        validator: (v) => !v || /^https?:\/\/.+/.test(v),
        message: 'Project URL must be a valid URL'
      }
    }
  }],

  companyUrl: {
    type: String,
    trim: true,
    default: '',
    validate: {
      validator: (v) => !v || /^https?:\/\/.+/.test(v),
      message: 'Company URL must be a valid URL'
    }
  },

  logo: {
    filename: String,
    originalName: String,
    url: String,
    publicId: String,
    size: Number
  },

  // FIX: "featured" (not isFeatured)
  featured: {
    type: Boolean,
    default: false
  },

  // FIX: status encodes visibility — 'active' = visible, 'inactive' = hidden
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive'],
      message: '{VALUE} is not a valid status'
    },
    default: 'active'
  },

  // FIX: "order" (not displayOrder)
  order: {
    type: Number,
    default: 0,
    min: [0, 'Order must be a non-negative number']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===========================
// INDEXES
// ===========================
experienceSchema.index({ company: 1 });
experienceSchema.index({ type: 1 });
experienceSchema.index({ startDate: -1 });
experienceSchema.index({ endDate: -1 });
experienceSchema.index({ current: -1, startDate: -1 });
experienceSchema.index({ featured: -1 });
experienceSchema.index({ status: 1, order: 1 });
experienceSchema.index({ status: 1, current: -1, endDate: -1 });
experienceSchema.index({ status: 1, type: 1, current: -1 });

// ===========================
// VIRTUALS
// ===========================
experienceSchema.virtual('duration').get(function () {
  const start = this.startDate;
  const end = this.endDate || new Date();

  let totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (end.getDate() < start.getDate()) totalMonths--;
  if (totalMonths < 0) totalMonths = 0;

  const displayYears = Math.floor(totalMonths / 12);
  const displayMonths = totalMonths % 12;

  if (displayYears === 0 && displayMonths === 0) return 'Less than 1 month';
  if (displayYears === 0) return `${displayMonths} month${displayMonths !== 1 ? 's' : ''}`;
  if (displayMonths === 0) return `${displayYears} year${displayYears !== 1 ? 's' : ''}`;
  return `${displayYears} year${displayYears !== 1 ? 's' : ''}, ${displayMonths} month${displayMonths !== 1 ? 's' : ''}`;
});

experienceSchema.virtual('durationMonths').get(function () {
  const start = this.startDate;
  const end = this.endDate || new Date();

  let totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (end.getDate() < start.getDate()) totalMonths--;
  return Math.max(0, totalMonths);
});

// ===========================
// MIDDLEWARE
// ===========================
experienceSchema.pre('save', function (next) {
  if (this.current) this.endDate = null;

  if (!this.current && this.endDate && this.startDate >= this.endDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

experienceSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const isCurrent = update.current ?? update.$set?.current;

  if (isCurrent) {
    if (update.$set) update.$set.endDate = null;
    else update.endDate = null;
  }
  next();
});

// ===========================
// METHODS
// ===========================
experienceSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.status;
  return obj;
};

// ===========================
// STATICS
// ===========================
experienceSchema.statics.getActiveByType = function (type) {
  return this.find({ status: 'active', type })
    .sort({ current: -1, endDate: -1, startDate: -1 })
    .select('-__v -status');
};

experienceSchema.statics.getCurrentExperiences = function () {
  return this.find({ status: 'active', current: true })
    .sort({ startDate: -1 })
    .select('-__v -status');
};

experienceSchema.statics.getFeatured = function (limit = 5) {
  return this.find({ status: 'active', featured: true })
    .sort({ current: -1, endDate: -1 })
    .limit(limit)
    .select('-__v -status');
};

module.exports = mongoose.model('Experience', experienceSchema);