// scripts/checkCloudinaryResume.js
require('dotenv').config();
const path = require('path');
const cloudinary = require(path.join(__dirname, '..', 'config', 'cloudinary'));

async function checkResume() {
  try {
    console.log('🔍 Searching for resume files in Cloudinary...\n');

    // Search for any files in the resume folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'portfolio/resume',
      resource_type: 'raw',
      max_results: 10
    });

    if (result.resources.length === 0) {
      console.log('❌ No resume files found in portfolio/resume folder');
      return;
    }

    console.log(`✅ Found ${result.resources.length} file(s):\n`);

    result.resources.forEach((resource, index) => {
      console.log(`File ${index + 1}:`);
      console.log('  Public ID:', resource.public_id);
      console.log('  Format:', resource.format);
      console.log('  Created:', resource.created_at);
      console.log('  Size:', (resource.bytes / 1024).toFixed(2), 'KB');
      console.log('  URL:', resource.secure_url);
      
      // Generate signed URL
      const signedUrl = cloudinary.url(resource.public_id, {
        resource_type: 'raw',
        type: 'upload',
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 31536000
      });
      console.log('  Signed URL:', signedUrl);
      console.log('');
    });

    console.log('\n💡 Use the correct public_id from above in your database.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.error && error.error.message) {
      console.error('Details:', error.error.message);
    }
  }
}

checkResume();