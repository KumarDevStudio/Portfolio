// ============================================
// FILE: models/About.js - FIXED VERSION
// ============================================

const mongoose = require('mongoose');

const statSchema = new mongoose.Schema({
  icon: {
    type: String,
    required: true,
    enum: ['MapPin', 'Calendar', 'Coffee', 'Code', 'Heart', 'Zap', 'Users', 'BookOpen', 'Target', 'Award'],
    default: 'Code'
  },
  label: {
    type: String,
    required: true,
    maxlength: 50
  },
  value: {
    type: String,
    required: true,
    maxlength: 100
  },
  color: {
    type: String,
    required: true,
    default: 'text-blue-600 dark:text-blue-400'
  },
  order: {
    type: Number,
    required: true,
    default: 0
  }
}, { _id: false });

const valueSchema = new mongoose.Schema({
  icon: {
    type: String,
    required: true,
    enum: ['MapPin', 'Calendar', 'Coffee', 'Code', 'Heart', 'Zap', 'Users', 'BookOpen', 'Target', 'Award'],
    default: 'Heart'
  },
  title: {
    type: String,
    required: true,
    maxlength: 50
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  order: {
    type: Number,
    required: true,
    default: 0
  }
}, { _id: false });

const aboutSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  experience: {
    type: String,
    required: [true, 'Experience is required'],
    trim: true,
    maxlength: [50, 'Experience cannot exceed 50 characters']
  },
  imageUrl: {
    type: String,
    trim: true,
    default: function() {
      // Return inline SVG placeholder if no image provided
      return `data:image/svg+xml,${encodeURIComponent(`
        <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:0.1" />
              <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0.1" />
            </linearGradient>
          </defs>
          <rect width="400" height="500" fill="url(#grad)"/>
          <circle cx="200" cy="180" r="60" fill="#E5E7EB"/>
          <path d="M140 280 Q200 260 260 280 L260 320 Q200 360 140 320 Z" fill="#E5E7EB"/>
          <text x="50%" y="420" font-family="Arial" font-size="16" fill="#6B7280" text-anchor="middle">${this.name || 'User'}</text>
        </svg>
      `)}`;
    }
  },
  imageAlt: {
    type: String,
    trim: true,
    default: function() {
      return `Professional headshot of ${this.name || 'developer'}`;
    }
  },
  tagline: {
    type: String,
    required: [true, 'Tagline is required'],
    trim: true,
    maxlength: [200, 'Tagline cannot exceed 200 characters'],
    default: 'Passionate full-stack developer crafting digital experiences with modern technologies'
  },
  mainDescription: {
    type: String,
    required: [true, 'Main description is required'],
    trim: true,
    maxlength: [1000, 'Main description cannot exceed 1000 characters']
  },
  secondaryDescription: {
    type: String,
    trim: true,
    maxlength: [500, 'Secondary description cannot exceed 500 characters'],
    default: ''
  },
  beyondCodeTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Beyond code title cannot exceed 100 characters'],
    default: 'Beyond the Code'
  },
  beyondCodeContent: {
    type: String,
    trim: true,
    maxlength: [500, 'Beyond code content cannot exceed 500 characters'],
    default: 'When I\'m not coding, I enjoy exploring new frameworks, contributing to open source projects, writing technical articles, and mentoring aspiring developers.'
  },
  stats: {
    type: [statSchema],
    default: function() {
      return [
        {
          icon: 'MapPin',
          label: 'Location',
          value: this.location || 'Not specified',
          color: 'text-blue-600 dark:text-blue-400',
          order: 0
        },
        {
          icon: 'Calendar',
          label: 'Experience',
          value: this.experience || '0 Years',
          color: 'text-green-600 dark:text-green-400',
          order: 1
        },
        {
          icon: 'Code',
          label: 'Projects',
          value: '3+ Completed',
          color: 'text-purple-600 dark:text-purple-400',
          order: 2
        }
      ];
    },
    validate: {
      validator: function(v) {
        return v.length <= 6;
      },
      message: 'Cannot have more than 6 stats'
    }
  },
  values: {
    type: [valueSchema],
    default: [
      {
        icon: 'Heart',
        title: 'Passionate',
        description: 'Love crafting beautiful and functional web experiences',
        order: 0
      },
      {
        icon: 'Zap',
        title: 'Innovative',
        description: 'Always exploring cutting-edge technologies and solutions',
        order: 1
      },
      {
        icon: 'BookOpen',
        title: 'Learner',
        description: 'Continuously updating skills and sharing knowledge',
        order: 2
      },
      {
        icon: 'Target',
        title: 'Result-Driven',
        description: 'Focused on delivering high-quality, scalable solutions',
        order: 3
      }
    ],
    validate: {
      validator: function(v) {
        return v.length <= 8;
      },
      message: 'Cannot have more than 8 values'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
aboutSchema.index({ isActive: 1, createdAt: -1 });

// ============================================
// STATIC METHODS - CRITICAL FIX HERE
// ============================================

/**
 * Get active about content for public display
 * @returns {Promise<Object|null>}
 */
aboutSchema.statics.getPublic = async function() {
  try {
    let about = await this.findOne({ isActive: true })
      .select('-metadata -__v')
      .lean();

    // If no data in database, return complete default data
    if (!about) {
      console.log('⚠️ No about data in database, returning defaults');
      return {
        name: 'Kishan Kumar',
        location: 'Chandigarh, India',
        experience: '0.5 years',
        imageUrl: `data:image/svg+xml,${encodeURIComponent(`
          <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:0.1" />
                <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0.1" />
              </linearGradient>
            </defs>
            <rect width="400" height="500" fill="url(#grad)"/>
            <circle cx="200" cy="180" r="60" fill="#E5E7EB"/>
            <path d="M140 280 Q200 260 260 280 L260 320 Q200 360 140 320 Z" fill="#E5E7EB"/>
            <text x="50%" y="420" font-family="Arial" font-size="16" fill="#6B7280" text-anchor="middle">Kishan Kumar</text>
          </svg>
        `)}`,
        imageAlt: 'Professional headshot of Kishan Kumar, a full-stack developer',
        tagline: 'Passionate full-stack developer crafting digital experiences with modern technologies',
        mainDescription: 'With 0.5 years of experience as a full-stack developer, I specialize in building scalable applications using the MERN stack, JWT authentication, and RESTful APIs. My journey began with a BCA from Panjab University (2021-2024), fueling my passion for clean code and innovative solutions.',
        secondaryDescription: 'Driven by curiosity, I focus on creating maintainable, elegant code to solve real-world problems, continuously learning and contributing to the tech community.',
        beyondCodeTitle: 'Beyond the Code',
        beyondCodeContent: 'When I\'m not coding, I enjoy exploring new frameworks, contributing to open source projects, writing technical articles, and mentoring aspiring developers. I believe in giving back to the community that has given me so much.',
        stats: [
          {
            icon: 'MapPin',
            label: 'Location',
            value: 'Chandigarh, India',
            color: 'text-blue-600 dark:text-blue-400',
            order: 0
          },
          {
            icon: 'Calendar',
            label: 'Experience',
            value: '0.5 Years',
            color: 'text-green-600 dark:text-green-400',
            order: 1
          },
          {
            icon: 'Code',
            label: 'Projects',
            value: '3+ Completed',
            color: 'text-purple-600 dark:text-purple-400',
            order: 2
          }
        ],
        values: [
          {
            icon: 'Heart',
            title: 'Passionate',
            description: 'Love crafting beautiful and functional web experiences',
            order: 0
          },
          {
            icon: 'Zap',
            title: 'Innovative',
            description: 'Always exploring cutting-edge technologies and solutions',
            order: 1
          },
          {
            icon: 'BookOpen',
            title: 'Learner',
            description: 'Continuously updating skills and sharing knowledge',
            order: 2
          },
          {
            icon: 'Target',
            title: 'Result-Driven',
            description: 'Focused on delivering high-quality, scalable solutions',
            order: 3
          }
        ]
      };
    }

    // CRITICAL FIX: Ensure stats and values exist and are complete
    if (!about.stats || about.stats.length === 0) {
      console.log('⚠️ No stats in database, using defaults');
      about.stats = [
        {
          icon: 'MapPin',
          label: 'Location',
          value: about.location || 'Not specified',
          color: 'text-blue-600 dark:text-blue-400',
          order: 0
        },
        {
          icon: 'Calendar',
          label: 'Experience',
          value: about.experience || '0 Years',
          color: 'text-green-600 dark:text-green-400',
          order: 1
        },
        {
          icon: 'Code',
          label: 'Projects',
          value: '3+ Completed',
          color: 'text-purple-600 dark:text-purple-400',
          order: 2
        }
      ];
    }

    if (!about.values || about.values.length === 0) {
      console.log('⚠️ No values in database, using defaults');
      about.values = [
        {
          icon: 'Heart',
          title: 'Passionate',
          description: 'Love crafting beautiful and functional web experiences',
          order: 0
        },
        {
          icon: 'Zap',
          title: 'Innovative',
          description: 'Always exploring cutting-edge technologies and solutions',
          order: 1
        },
        {
          icon: 'BookOpen',
          title: 'Learner',
          description: 'Continuously updating skills and sharing knowledge',
          order: 2
        },
        {
          icon: 'Target',
          title: 'Result-Driven',
          description: 'Focused on delivering high-quality, scalable solutions',
          order: 3
        }
      ];
    }

    // Ensure all required fields have defaults
    about.imageAlt = about.imageAlt || `Professional headshot of ${about.name}`;
    about.secondaryDescription = about.secondaryDescription || '';
    about.beyondCodeTitle = about.beyondCodeTitle || 'Beyond the Code';
    about.beyondCodeContent = about.beyondCodeContent || 'When I\'m not coding, I enjoy exploring new technologies.';

    console.log('✅ Returning complete about data:', {
      name: about.name,
      statsCount: about.stats.length,
      valuesCount: about.values.length
    });

    return about;
  } catch (error) {
    console.error('❌ Error in getPublic:', error);
    throw error;
  }
};

/**
 * Get active about content (admin view with metadata)
 * @returns {Promise<Object|null>}
 */
aboutSchema.statics.getActive = async function() {
  return this.findOne({ isActive: true })
    .populate('metadata.createdBy', 'username email')
    .populate('metadata.updatedBy', 'username email')
    .lean();
};

// Pre-save hook to ensure defaults
aboutSchema.pre('save', function(next) {
  // Ensure stats array has at least 3 items
  if (!this.stats || this.stats.length === 0) {
    this.stats = [
      {
        icon: 'MapPin',
        label: 'Location',
        value: this.location || 'Not specified',
        color: 'text-blue-600 dark:text-blue-400',
        order: 0
      },
      {
        icon: 'Calendar',
        label: 'Experience',
        value: this.experience || '0 Years',
        color: 'text-green-600 dark:text-green-400',
        order: 1
      },
      {
        icon: 'Code',
        label: 'Projects',
        value: '3+ Completed',
        color: 'text-purple-600 dark:text-purple-400',
        order: 2
      }
    ];
  }

  // Ensure values array has at least 4 items
  if (!this.values || this.values.length === 0) {
    this.values = [
      {
        icon: 'Heart',
        title: 'Passionate',
        description: 'Love crafting beautiful and functional web experiences',
        order: 0
      },
      {
        icon: 'Zap',
        title: 'Innovative',
        description: 'Always exploring cutting-edge technologies and solutions',
        order: 1
      },
      {
        icon: 'BookOpen',
        title: 'Learner',
        description: 'Continuously updating skills and sharing knowledge',
        order: 2
      },
      {
        icon: 'Target',
        title: 'Result-Driven',
        description: 'Focused on delivering high-quality, scalable solutions',
        order: 3
      }
    ];
  }

  next();
});

const About = mongoose.model('About', aboutSchema);

module.exports = About;