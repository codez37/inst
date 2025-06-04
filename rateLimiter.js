const logger = require('./logger');
const config = require('./config');

/**
 * کلاس مدیریت محدودیت نرخ درخواست‌ها
 */
class RateLimiter {
  constructor() {
    this.requests = new Map(); // ذخیره درخواست‌های کاربران
    this.cleanupInterval = null;
    this.setupCleanup();
  }

  /**
   * بررسی اینکه آیا کاربر می‌تواند درخواست ارسال کند
   * @param {string} userId - شناسه کاربر
   * @returns {object} نتیجه بررسی
   */
  checkRateLimit(userId) {
    if (!config.rateLimit.enableRateLimit) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;
    const maxRequests = config.rateLimit.maxRequests;

    // دریافت یا ایجاد رکورد کاربر
    if (!this.requests.has(userId)) {
      this.requests.set(userId, {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now
      });
    }

    const userRecord = this.requests.get(userId);

    // بررسی اینکه آیا پنجره زمانی تمام شده
    if (now >= userRecord.resetTime) {
      userRecord.count = 0;
      userRecord.resetTime = now + windowMs;
      userRecord.firstRequest = now;
    }

    // بررسی محدودیت
    if (userRecord.count >= maxRequests) {
      const resetIn = Math.ceil((userRecord.resetTime - now) / 1000);
      logger.warn(`Rate limit exceeded for user ${userId}. Reset in ${resetIn} seconds.`);
      
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        message: `شما بیش از حد مجاز درخواست ارسال کرده‌اید. لطفاً ${resetIn} ثانیه صبر کنید.`
      };
    }

    // افزایش شمارنده
    userRecord.count++;
    const remaining = maxRequests - userRecord.count;

    logger.info(`Rate limit check for user ${userId}: ${userRecord.count}/${maxRequests}`);

    return {
      allowed: true,
      remaining,
      resetIn: Math.ceil((userRecord.resetTime - now) / 1000)
    };
  }

  /**
   * دریافت آمار کاربر
   * @param {string} userId - شناسه کاربر
   * @returns {object|null} آمار کاربر
   */
  getUserStats(userId) {
    const userRecord = this.requests.get(userId);
    if (!userRecord) return null;

    const now = Date.now();
    return {
      requestCount: userRecord.count,
      remaining: Math.max(0, config.rateLimit.maxRequests - userRecord.count),
      resetIn: Math.ceil((userRecord.resetTime - now) / 1000),
      firstRequest: new Date(userRecord.firstRequest)
    };
  }

  /**
   * ریست کردن محدودیت کاربر
   * @param {string} userId - شناسه کاربر
   * @returns {boolean} موفقیت عملیات
   */
  resetUserLimit(userId) {
    if (this.requests.has(userId)) {
      this.requests.delete(userId);
      logger.info(`Rate limit reset for user ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * دریافت آمار کلی
   * @returns {object} آمار کلی
   */
  getGlobalStats() {
    const now = Date.now();
    let activeUsers = 0;
    let totalRequests = 0;
    let blockedUsers = 0;

    for (const [userId, record] of this.requests.entries()) {
      if (now < record.resetTime) {
        activeUsers++;
        totalRequests += record.count;
        if (record.count >= config.rateLimit.maxRequests) {
          blockedUsers++;
        }
      }
    }

    return {
      activeUsers,
      totalRequests,
      blockedUsers,
      averageRequestsPerUser: activeUsers > 0 ? (totalRequests / activeUsers).toFixed(2) : 0,
      rateLimitEnabled: config.rateLimit.enableRateLimit,
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests
    };
  }

  /**
   * پاک‌سازی رکوردهای منقضی شده
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, record] of this.requests.entries()) {
      if (now >= record.resetTime + config.rateLimit.windowMs) {
        this.requests.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired rate limit records`);
    }
  }

  /**
   * راه‌اندازی پاک‌سازی خودکار
   */
  setupCleanup() {
    // پاک‌سازی هر 5 دقیقه
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('Rate limiter cleanup scheduled every 5 minutes');
  }

  /**
   * توقف پاک‌سازی خودکار
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Rate limiter cleanup stopped');
    }
  }

  /**
   * اضافه کردن کاربر به لیست سیاه موقت
   * @param {string} userId - شناسه کاربر
   * @param {number} duration - مدت زمان مسدودیت (میلی‌ثانیه)
   */
  temporaryBlock(userId, duration = 60000) { // پیش‌فرض 1 دقیقه
    const now = Date.now();
    this.requests.set(userId, {
      count: config.rateLimit.maxRequests + 1, // بیشتر از حد مجاز
      resetTime: now + duration,
      firstRequest: now,
      isBlocked: true
    });

    logger.warn(`User ${userId} temporarily blocked for ${duration / 1000} seconds`);
  }

  /**
   * بررسی اینکه آیا کاربر مسدود است
   * @param {string} userId - شناسه کاربر
   * @returns {boolean} وضعیت مسدودیت
   */
  isUserBlocked(userId) {
    const userRecord = this.requests.get(userId);
    if (!userRecord) return false;

    const now = Date.now();
    return userRecord.isBlocked && now < userRecord.resetTime;
  }
}

// ایجاد نمونه سراسری
const rateLimiter = new RateLimiter();

/**
 * میدل‌ویر برای بررسی محدودیت نرخ
 * @param {string} userId - شناسه کاربر
 * @returns {Promise<object>} نتیجه بررسی
 */
async function checkUserRateLimit(userId) {
  return rateLimiter.checkRateLimit(userId);
}

/**
 * میدل‌ویر برای مدیریت درخواست‌های Instagram
 * @param {string} userId - شناسه کاربر
 * @param {Function} next - تابع بعدی
 * @returns {Promise<boolean>} آیا درخواست مجاز است
 */
async function instagramRateLimitMiddleware(userId, next) {
  const result = await checkUserRateLimit(userId);
  
  if (!result.allowed) {
    logger.warn(`Request blocked for user ${userId}: ${result.message}`);
    return false;
  }

  // اجرای تابع بعدی
  if (typeof next === 'function') {
    await next();
  }

  return true;
}

// مدیریت خاموشی برنامه
process.on('SIGINT', () => {
  rateLimiter.stopCleanup();
});

process.on('SIGTERM', () => {
  rateLimiter.stopCleanup();
});

module.exports = {
  rateLimiter,
  checkUserRateLimit,
  instagramRateLimitMiddleware,
  RateLimiter
};