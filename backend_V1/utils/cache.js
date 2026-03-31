'use strict';

// ============================================================
// utils/cache.js — Simple in-memory TTL cache (no Redis)
// ============================================================

const { logger } = require('../utils/helpers');

// key → { value, expiresAt }
const store = new Map();

// ─── Core Cache ──────────────────────────────────────────────
const cache = {
  async get(key) {
    const entry = store.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }

    return entry.value;
  },

  async set(key, value, ttlSeconds = 300) {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key) {
    store.delete(key);
  },

  async delByPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

    for (const key of store.keys()) {
      if (regex.test(key)) {
        store.delete(key);
      }
    }
  },

  // Optional: debugging
  stats() {
    return {
      keys: store.size,
    };
  },
};

// ─── Cache Keys ──────────────────────────────────────────────
const CACHE_KEYS = {
  publicAbout: 'about:public',
  allAbout:    'about:admin:all',
};

// ─── TTL Config ──────────────────────────────────────────────
const CACHE_TTL = {
  publicAbout: 5 * 60, // 5 min
  allAbout:    60,     // 1 min
};

module.exports = { cache, CACHE_KEYS, CACHE_TTL };