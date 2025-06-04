const logger = require('./logger');
const { connectDB, cleanupOldRequests } = require('./dbService');
const { startBot, stopBot } = require('./instagramClient');
const { startHealthCheckServer } = require('./healthCheck');
const { clearCache } = require('./cacheService');
const config = require('./config');

// متغیرهای وضعیت
let isShuttingDown = false;
let startTime = new Date();

/**
 * تابع اصلی برنامه
 */
async function main() {
  try {
    logger.info('🚀 Starting Instagram Tax Bot...');
    logger.info(`Environment: ${config.app.environment}`);
    logger.info(`Log Level: ${config.app.logLevel}`);
    
    // اتصال به دیتابیس
    logger.info('📊 Connecting to database...');
    await connectDB();
    
    // پاک‌سازی درخواست‌های قدیمی (اختیاری)
    if (config.app.environment === 'production') {
      logger.info('🧹 Cleaning up old requests...');
      const cleanedCount = await cleanupOldRequests(90); // 90 روز
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old requests`);
      }
    }
    
    // شروع سرور health check
    if (config.app.enableHealthCheck) {
      logger.info('🏥 Starting health check server...');
      startHealthCheckServer();
    }
    
    // شروع ربات Instagram
    logger.info('📱 Starting Instagram bot...');
    await startBot();
    
    logger.info('✅ Instagram Tax Bot started successfully!');
    logger.info(`🕐 Started at: ${startTime.toISOString()}`);
    
    // نمایش آمار اولیه
    displayStartupStats();
    
    // راه‌اندازی تسک‌های دوره‌ای
    setupPeriodicTasks();
    
  } catch (error) {
    logger.error('❌ Failed to start bot:', error);
    await gracefulShutdown(1);
  }
}

/**
 * نمایش آمار راه‌اندازی
 */
function displayStartupStats() {
  const stats = {
    'Node.js Version': process.version,
    'Platform': process.platform,
    'Memory Usage': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    'PID': process.pid,
    'Environment': config.app.environment,
    'Features': {
      'Comment Reply': config.ig.enableCommentReply ? '✅' : '❌',
      'Rate Limiting': config.rateLimit.enableRateLimit ? '✅' : '❌',
      'Health Check': config.app.enableHealthCheck ? '✅' : '❌',
      'Metrics': config.app.enableMetrics ? '✅' : '❌',
      'Advanced Tax': config.tax.enableAdvancedCalculations ? '✅' : '❌'
    }
  };
  
  logger.info('📋 Startup Configuration:');
  Object.entries(stats).forEach(([key, value]) => {
    if (typeof value === 'object') {
      logger.info(`  ${key}:`);
      Object.entries(value).forEach(([subKey, subValue]) => {
        logger.info(`    ${subKey}: ${subValue}`);
      });
    } else {
      logger.info(`  ${key}: ${value}`);
    }
  });
}

/**
 * راه‌اندازی تسک‌های دوره‌ای
 */
function setupPeriodicTasks() {
  // پاک‌سازی cache هر 6 ساعت
  setInterval(() => {
    logger.info('🧹 Running periodic cache cleanup...');
    // فقط cache های قدیمی را پاک می‌کنیم، نه همه
    // این کار در cacheService خودکار انجام می‌شود
  }, 6 * 60 * 60 * 1000);
  
  // گزارش آمار هر ساعت
  setInterval(async () => {
    try {
      const { getStats } = require('./dbService');
      const { getCacheStats } = require('./cacheService');
      const { rateLimiter } = require('./rateLimiter');
      
      const dbStats = await getStats();
      const cacheStats = getCacheStats();
      const rateLimitStats = rateLimiter.getGlobalStats();
      
      logger.info('📊 Hourly Stats:', {
        database: {
          totalRequests: dbStats.totalRequests,
          todayRequests: dbStats.todayRequests,
          uniqueUsers: dbStats.uniqueUsers
        },
        cache: {
          hitRate: cacheStats.hitRate?.toFixed(2) || '0.00',
          keys: cacheStats.keys
        },
        rateLimit: {
          activeUsers: rateLimitStats.activeUsers,
          blockedUsers: rateLimitStats.blockedUsers
        },
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(process.uptime() / 3600)}h`
      });
      
    } catch (error) {
      logger.error('Error generating hourly stats:', error);
    }
  }, 60 * 60 * 1000);
  
  // پاک‌سازی درخواست‌های قدیمی هر روز
  if (config.app.environment === 'production') {
    setInterval(async () => {
      try {
        logger.info('🗑️ Running daily cleanup...');
        const cleanedCount = await cleanupOldRequests(90);
        if (cleanedCount > 0) {
          logger.info(`Daily cleanup: removed ${cleanedCount} old requests`);
        }
      } catch (error) {
        logger.error('Error in daily cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }
  
  logger.info('⏰ Periodic tasks scheduled');
}

/**
 * خاموشی مناسب برنامه
 * @param {number} exitCode - کد خروج
 */
async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  logger.info('🛑 Starting graceful shutdown...');
  
  try {
    // توقف ربات Instagram
    logger.info('📱 Stopping Instagram bot...');
    await stopBot();
    
    // قطع اتصال از دیتابیس
    logger.info('📊 Disconnecting from database...');
    const { disconnectDB } = require('./dbService');
    await disconnectDB();
    
    // پاک کردن cache (اختیاری)
    if (exitCode !== 0) {
      logger.info('🧹 Clearing cache...');
      clearCache('all');
    }
    
    const uptime = Math.round((new Date() - startTime) / 1000);
    logger.info(`✅ Graceful shutdown completed. Uptime: ${uptime}s`);
    
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

/**
 * مدیریت سیگنال‌های سیستم
 */
function setupSignalHandlers() {
  // SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal');
    gracefulShutdown(0);
  });
  
  // SIGTERM (Docker stop)
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal');
    gracefulShutdown(0);
  });
  
  // Unhandled Promise Rejection
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise
    });
    
    // در محیط production، برنامه را خاموش کن
    if (config.app.environment === 'production') {
      gracefulShutdown(1);
    }
  });
  
  // Uncaught Exception
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack
    });
    
    // همیشه برنامه را خاموش کن
    gracefulShutdown(1);
  });
  
  // Warning handler
  process.on('warning', (warning) => {
    logger.warn('Node.js Warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
  
  logger.info('🛡️ Signal handlers configured');
}

/**
 * بررسی پیش‌نیازها
 */
function checkPrerequisites() {
  const required = [
    'IG_USERNAME',
    'IG_PASSWORD',
    'MONGODB_URI'
  ];
  
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:', missing);
    logger.error('💡 Please check your .env file or environment variables');
    logger.error('📋 Required variables: IG_USERNAME, IG_PASSWORD, MONGODB_URI');
    process.exit(1);
  }
  
  // بررسی نسخه Node.js
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    logger.error(`❌ Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
    process.exit(1);
  }
  
  // بررسی اتصال به اینترنت (اختیاری)
  logger.info('✅ Prerequisites check passed');
  logger.info(`📋 Environment: ${config.app.environment}`);
  logger.info(`🔧 Node.js: ${nodeVersion}`);
}

/**
 * راه‌اندازی اولیه
 */
function initialize() {
  logger.info('🔧 Initializing Instagram Tax Bot...');
  
  // بررسی پیش‌نیازها
  checkPrerequisites();
  
  // راه‌اندازی signal handlers
  setupSignalHandlers();
  
  // شروع برنامه اصلی
  main().catch((error) => {
    logger.error('❌ Fatal error during initialization:', error);
    process.exit(1);
  });
}

// شروع برنامه
initialize();