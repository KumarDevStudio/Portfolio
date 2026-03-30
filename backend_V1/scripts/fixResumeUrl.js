// scripts/fixResumeUrl.js
// Run this ONCE to fix your existing resume URL in the database

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Import from your project structure
const cloudinary = require(path.join(__dirname, '..', 'config', 'cloudinary'));
const Profile = require(path.join(__dirname, '..', 'models', 'Profile'));

/**
 * Generate signed URL for resume
 */
function generateSignedResumeUrl(publicId) {
  const expiresAt = Math.floor(Date.now() / 1000) + 31536000; // 1 year from now
  
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    sign_url: true,
    secure: true,
    expires_at: expiresAt
  });
}

async function fixResumeUrl() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔍 Finding profile with resume...');
    const profile = await Profile.findOne({ isCurrent: true });

    if (!profile) {
      console.log('❌ No profile found!');
      process.exit(1);
    }

    if (!profile.resume?.publicId) {
      console.log('❌ No resume found in profile!');
      process.exit(1);
    }

    console.log('\n📄 Current resume data:');
    console.log('   Public ID:', profile.resume.publicId);
    console.log('   Current URL:', profile.resume.url);
    console.log('   Filename:', profile.resume.filename);

    // Use the ACTUAL public_id from Cloudinary
    const correctPublicId = 'portfolio/resume/Kishan_Kumar_Resume.pdf';
    
    if (profile.resume.publicId !== correctPublicId) {
      console.log('\n⚠️  Correcting publicId to match Cloudinary');
      console.log('   Old publicId:', profile.resume.publicId);
      console.log('   New publicId:', correctPublicId);
    }

    console.log('\n🔐 Generating signed URL...');
    const signedUrl = generateSignedResumeUrl(correctPublicId);
    
    console.log('\n✨ New signed URL generated:');
    console.log('   URL:', signedUrl);
    console.log('   Expires:', new Date((Math.floor(Date.now() / 1000) + 31536000) * 1000).toISOString());

    // Test the URL (optional - skipped if node-fetch not installed)
    console.log('\n🧪 Testing URL accessibility...');
    try {
      const fetch = require('node-fetch');
      const response = await fetch(signedUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ URL is accessible! Status:', response.status);
      } else {
        console.log('⚠️  URL returned status:', response.status);
      }
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('⚠️  Skipping URL test (node-fetch not installed)');
      } else {
        console.log('⚠️  Could not test URL:', error.message);
      }
    }

    // Update database with corrected publicId and signed URL
    console.log('\n💾 Updating database...');
    profile.resume.publicId = correctPublicId; // Update with correct publicId from Cloudinary
    profile.resume.url = signedUrl;
    await profile.save();

    console.log('✅ Database updated successfully!');
    
    console.log('\n✅ DONE! Your resume URL has been fixed.');
    console.log('   The signed URL will expire in 1 year.');
    console.log('   Set up a cron job to refresh it periodically.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the script
fixResumeUrl();