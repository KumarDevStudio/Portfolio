
// ===================================================
// utils/mongodb-health.js - MongoDB Health Checker
// ===================================================
class MongoDBHealthChecker {
  constructor() {
    this.lastCheck = null;
    this.checkInterval = 30000; // 30 seconds
    this.isMonitoring = false;
  }

  async checkHealth() {
    try {
      const adminDb = mongoose.connection.db.admin();
      const result = await adminDb.ping();
      
      this.lastCheck = {
        timestamp: new Date(),
        status: 'healthy',
        ping: result
      };
      
      return true;
    } catch (error) {
      this.lastCheck = {
        timestamp: new Date(),
        status: 'unhealthy',
        error: error.message
      };
      
      logger.error('MongoDB health check failed:', error.message);
      return false;
    }
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    const monitor = setInterval(async () => {
      if (!mongoose.connection.readyState === 1) {
        clearInterval(monitor);
        this.isMonitoring = false;
        return;
      }
      
      await this.checkHealth();
    }, this.checkInterval);
    
    logger.info('MongoDB health monitoring started');
  }

  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('MongoDB health monitoring stopped');
  }

  getLastCheck() {
    return this.lastCheck;
  }
}
