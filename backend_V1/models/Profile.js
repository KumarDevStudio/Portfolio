const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  icon: { type: String, required: false, default: '' },
  title: { type: String, required: false, default: '' }, // Change to 'text' if your schema uses it
  description: { type: String, required: false, default: '' },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true } // Allow _id in subdocuments
});

const profileSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  title: { type: String, required: true },
  bio: { type: String, required: true },
  profileImage: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' }
  },
  resume: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
    filename: { type: String, default: '' }
  },
  socialLinks: {
    type: Map,
    of: String,
    default: {}
  },
  features: [featureSchema],
  metaTitle: { type: String, required: false, default: '' },
  metaDescription: { type: String, required: false, default: '' },
  isCurrent: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

profileSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Profile', profileSchema);