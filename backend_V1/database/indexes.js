

// ===================================================
// src/database/indexes.js
// ===================================================
const mongoose = require('mongoose');

async function createIndexes() {
  const db = mongoose.connection.db;

  // Projects indexes
  await db.collection('projects').createIndexes([
    { key: { slug: 1 }, unique: true },
    { key: { title: 'text', description: 'text', technologies: 'text' } },
    { key: { featured: -1, createdAt: -1 } },
    { key: { status: 1, visibility: 1 } },
    { key: { category: 1 } },
    { key: { technologies: 1 } },
    { key: { createdAt: -1 } }
  ]);

  // Skills indexes
  await db.collection('skills').createIndexes([
    { key: { name: 1 }, unique: true },
    { key: { category: 1 } },
    { key: { level: -1 } },
    { key: { featured: -1 } }
  ]);

  // Experience indexes
  await db.collection('experiences').createIndexes([
    { key: { company: 1 } },
    { key: { startDate: -1 } },
    { key: { endDate: -1 } },
    { key: { current: -1 } },
    { key: { featured: -1 } }
  ]);

  // Contacts indexes
  await db.collection('contacts').createIndexes([
    { key: { email: 1 } },
    { key: { status: 1 } },
    { key: { createdAt: -1 } },
    { key: { priority: -1 } }
  ]);

  // Users indexes
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { username: 1 }, unique: true, sparse: true },
    { key: { role: 1 } }
  ]);

  // Refresh tokens indexes
  await db.collection('refreshtokens').createIndexes([
    { key: { token: 1 }, unique: true },
    { key: { userId: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
  ]);
}

module.exports = { createIndexes };