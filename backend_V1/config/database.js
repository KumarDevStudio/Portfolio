// ===================================================
// config/database.js - Database Configuration
// ===================================================
const mongoose = require('mongoose');
const { logger } = require('../utils/helpers');

class DatabaseConfig {
  constructor() {
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Get Mongoose connection options based on environment
   */
  getConnectionOptions() {
    const IS_PRODUCTION = process.env.NODE_ENV === 'production';

    return {
      // Connection pool settings
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
      
      // Timeout settings
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      
      // Read preference
      readPreference: 'primary',

      // Production-specific options
      ...(IS_PRODUCTION && {
        retryWrites: true,
        w: 'majority',
        compressors: ['zlib'],
        zlibCompressionLevel: 6
      }),

      // Development-specific options
      ...(!IS_PRODUCTION && {
        autoIndex: true,   // Build indexes automatically in development
        autoCreate: true   // Auto-create collections in development
      })
    };
  }

  /**
   * Validate and get MongoDB connection string
   */
  getConnectionString() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
      throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
    }

    return mongoUri;
  }

  /**
   * Setup event handlers for connection lifecycle
   */
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      this.connectionAttempts = 0;
      logger.info(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', {
        error: err.message,
        code: err.code,
        attempt: this.connectionAttempts
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected successfully');
    });

    mongoose.connection.on('close', () => {
      logger.info('🔌 MongoDB connection closed');
    });

  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect() {
    try {
      this.connectionAttempts++;
      const connectionString = this.getConnectionString();
      const options = this.getConnectionOptions();

      logger.info(`Attempting MongoDB connection (attempt ${this.connectionAttempts}/${this.maxRetries})...`);

      await mongoose.connect(connectionString, options);
      this.setupEventHandlers();

      return true;
    } catch (error) {
      logger.error('❌ MongoDB connection failed:', {
        error: error.message,
        code: error.code,
        attempt: this.connectionAttempts,
        maxRetries: this.maxRetries
      });

      // Retry logic
      if (this.connectionAttempts < this.maxRetries) {
        logger.info(`Retrying in ${this.retryDelay / 1000} seconds...`);
        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.connect();
            resolve(result);
          }, this.retryDelay);
        });
      } else {
        logger.error('🚨 Maximum connection attempts reached. Shutting down...');
        process.exit(1);
      }
    }
  }

  /**
   * Gracefully disconnect from MongoDB
   */
  async disconnect() {
    if (this.isHealthy()) {
      try {
        await mongoose.connection.close();
        logger.info('🛑 MongoDB disconnected gracefully');
      } catch (error) {
        logger.error('Error during disconnection:', error.message);
      }
    }
  }








  
/**
   * Check if database connection is healthy
   * Uses readyState as the single source of truth
   * readyState values: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
   */
  isHealthy() {
    // readyState 1 means connected - this is the source of truth
    return mongoose.connection.readyState === 1;
  }

  /**
   * Ping database to verify active connection
   * @returns {Promise<boolean>} True if ping successful, false otherwise
   */
  async ping() {
    try {
      // First check if we're connected
      if (!this.isHealthy()) {
        return false;
      }

      // Actually ping the database server
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('Database ping failed:', {
        error: error.message,
        readyState: mongoose.connection.readyState
      });
      return false;
    }
  }




  /**
   * Get detailed connection information
   */
  getConnectionInfo() {
    const connection = mongoose.connection;
    const readyState = connection.readyState;
    
    // Map readyState to status string
    const statusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return {
      status: statusMap[readyState] || 'unknown',
      readyState: readyState,
      host: connection.host || 'unknown',
      port: connection.port || 27017,
      name: connection.name || 'unknown',
      collections: Object.keys(connection.collections || {}),
      models: Object.keys(mongoose.models || {})
    };
  }
}

// Export singleton instance
module.exports = new DatabaseConfig();