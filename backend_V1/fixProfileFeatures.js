// fixProfileFeatures.js
const mongoose = require('mongoose');
const Profile = require('./models/Profile');

async function fixProfileFeatures() {
  try {
    // Connect to MongoDB (replace with your MongoDB URI from .env)
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio');
    console.log('Connected to MongoDB');

    // Find all profiles
    const profiles = await Profile.find({});

    for (const profile of profiles) {
      let updated = false;
      // Fix features array
      if (profile.features && profile.features.length > 0) {
        profile.features = profile.features.map((feature, index) => {
          if (!feature.icon) {
            updated = true;
            return {
              ...feature,
              icon: ['Code', 'Rocket', 'Shield'][index] || 'Code',
            };
          }
          return feature;
        });
      } else {
        // Set default features if empty
        updated = true;
        profile.features = [
          { icon: 'Code', title: 'MERN Stack', description: 'Full stack development' },
          { icon: 'Rocket', title: 'Scalability', description: 'Building scalable apps' },
          { icon: 'Shield', title: 'Security', description: 'Secure coding practices' },
        ];
      }

      if (updated) {
        await profile.save();
        console.log(`Updated profile ${profile._id}`);
      } else {
        console.log(`No changes needed for profile ${profile._id}`);
      }
    }

    console.log('Profile features fixed');
  } catch (error) {
    console.error('Error fixing profile features:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixProfileFeatures();