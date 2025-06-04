const express = require('express');
const logger = require('./logger');
const { isDBConnected, getStats } = require('./dbService');
const { getCacheStats } = require('./cacheService');
const { rateLimiter } = require('./rateLimiter');
const config = require('./config');

const app = express();

// Middleware برای JSON
app.use(express.json());

/**
 * بررسی سلامت کلی سیستم
 */
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.app.environment
    };

    // بررسی اتصال دیتابیس
    health.database = {
      connected: isDBConnected(),
      status: isDBConnected() ? 'connected' : 'disconnected'
    };

    // بررسی cache
    health.cache = {
      response: getCacheStats('response'),
      user: getCacheStats('user'),
      tax: getCacheStats('tax')
    };

    // بررسی rate limiter
    health.rateLimiter = rateLimiter.getGlobalStats();

    // تعیین وضعیت کلی
    if (!health.database.connected) {
      health.status = 'unhealthy';
      res.status(503);
    }

    res.json(health);
    
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * بررسی آمادگی سیستم
 */
app.get('/ready', async (req, res) => {
  try {
    const checks = {
      database: isDBConnected(),
      cache: true, // Cache همیشه آماده است
      rateLimiter: true
    };

    const allReady = Object.values(checks).every(check => check === true);

    if (allReady) {
      res.json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        checks,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * آمار عملکرد سیستم
 */
app.get('/metrics', async (req, res) => {
  try {
    if (!config.app.enableMetrics) {
      return res.status(404).json({ message: 'Metrics disabled' });
    }

    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    // آمار دیتابیس
    if (isDBConnected()) {
      metrics.database = await getStats();
    }

    // آمار cache
    metrics.cache = {
      response: getCacheStats('response'),
      user: getCacheStats('user'),
      tax: getCacheStats('tax')
    };

    // آمار rate limiter
    metrics.rateLimiter = rateLimiter.getGlobalStats();

    res.json(metrics);
    
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * اطلاعات پیکربندی (بدون اطلاعات حساس)
 */
app.get('/config', (req, res) => {
  try {
    const safeConfig = {
      app: {
        environment: config.app.environment,
        logLevel: config.app.logLevel,
        enableMetrics: config.app.enableMetrics,
        enableHealthCheck: config.app.enableHealthCheck
      },
      ig: {
        enableCommentReply: config.ig.enableCommentReply,
        enableStoryReply: config.ig.enableStoryReply,
        maxMessageLength: config.ig.maxMessageLength,
        requestDelay: config.ig.requestDelay
      },
      rateLimit: {
        enableRateLimit: config.rateLimit.enableRateLimit,
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.maxRequests
      },
      cache: {
        ttl: config.cache.ttl,
        maxKeys: config.cache.maxKeys
      },
      tax: {
        currentYear: config.tax.currentYear,
        enableAdvancedCalculations: config.tax.enableAdvancedCalculations,
        enableTaxReports: config.tax.enableTaxReports
      }
    };

    res.json(safeConfig);
    
  } catch (error) {
    logger.error('Config endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * لاگ‌های اخیر (محدود)
 */
app.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level || 'info';
    
    // این قسمت باید با سیستم لاگ واقعی پیاده‌سازی شود
    // فعلاً پیام ساده برمی‌گردانیم
    res.json({
      message: 'Log endpoint not fully implemented',
      suggestion: 'Check log files in ./logs directory',
      availableLevels: ['error', 'warn', 'info', 'debug'],
      requestedLevel: level,
      requestedLimit: limit
    });
    
  } catch (error) {
    logger.error('Logs endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * ریست کردن cache
 */
app.post('/admin/cache/clear', (req, res) => {
  try {
    const { type = 'all' } = req.body;
    const { clearCache } = require('./cacheService');
    
    const success = clearCache(type);
    
    if (success) {
      logger.info(`Cache cleared: ${type}`);
      res.json({
        status: 'success',
        message: `${type} cache cleared`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear cache'
      });
    }
    
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * ریست کردن rate limit کاربر
 */
app.post('/admin/ratelimit/reset', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId is required'
      });
    }
    
    const success = rateLimiter.resetUserLimit(userId);
    
    if (success) {
      logger.info(`Rate limit reset for user: ${userId}`);
      res.json({
        status: 'success',
        message: `Rate limit reset for user ${userId}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'User not found in rate limiter'
      });
    }
    
  } catch (error) {
    logger.error('Rate limit reset error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * شروع سرور health check
 */
function startHealthCheckServer() {
  if (!config.app.enableHealthCheck) {
    logger.info('Health check server disabled');
    return;
  }

  const port = config.app.port;
  
  app.listen(port, () => {
    logger.info(`Health check server running on port ${port}`);
    logger.info(`Available endpoints:`);
    logger.info(`  GET  /health - System health status`);
    logger.info(`  GET  /ready - Readiness check`);
    logger.info(`  GET  /metrics - Performance metrics`);
    logger.info(`  GET  /config - Configuration info`);
    logger.info(`  GET  /logs - Recent logs`);
    logger.info(`  POST /admin/cache/clear - Clear cache`);
    logger.info(`  POST /admin/ratelimit/reset - Reset user rate limit`);
  });

  // مدیریت خطاهای سرور
  app.on('error', (error) => {
    logger.error('Health check server error:', error);
  });
}

module.exports = {
  app,
  startHealthCheckServer
};