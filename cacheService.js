const NodeCache = require('node-cache');
const logger = require('./logger');
const crypto = require('crypto');

// تنظیمات cache
const CACHE_CONFIG = {
  stdTTL: 3600,           // 1 ساعت
  checkperiod: 600,       // بررسی هر 10 دقیقه
  useClones: false,       // برای بهبود عملکرد
  deleteOnExpire: true,
  maxKeys: 1000          // حداکثر 1000 کلید
};

// ایجاد نمونه‌های cache مختلف
const responseCache = new NodeCache(CACHE_CONFIG);
const userCache = new NodeCache({ ...CACHE_CONFIG, stdTTL: 7200 }); // 2 ساعت برای اطلاعات کاربر
const taxCache = new NodeCache({ ...CACHE_CONFIG, stdTTL: 86400 }); // 24 ساعت برای محاسبات مالیاتی

/**
 * تولید کلید cache امن
 * @param {string} threadId - شناسه thread
 * @param {string} text - متن
 * @param {string} type - نوع cache
 * @returns {string} کلید cache
 */
function generateCacheKey(threadId, text, type = 'response') {
  const hash = crypto.createHash('md5')
    .update(`${threadId}_${text}_${type}`)
    .digest('hex');
  return `${type}_${hash}`;
}

/**
 * دریافت پاسخ از cache
 * @param {string} key - کلید cache
 * @param {string} cacheType - نوع cache
 * @returns {any} داده cache شده یا null
 */
function getCachedResponse(key, cacheType = 'response') {
  try {
    let cache;
    switch (cacheType) {
      case 'user':
        cache = userCache;
        break;
      case 'tax':
        cache = taxCache;
        break;
      default:
        cache = responseCache;
    }

    const result = cache.get(key);
    if (result) {
      logger.info(`Cache hit for key: ${key.substring(0, 20)}...`);
      return result;
    }
    
    logger.info(`Cache miss for key: ${key.substring(0, 20)}...`);
    return null;
  } catch (error) {
    logger.error('Error getting cached response:', error.message);
    return null;
  }
}

/**
 * ذخیره پاسخ در cache
 * @param {string} key - کلید cache
 * @param {any} response - پاسخ برای ذخیره
 * @param {string} cacheType - نوع cache
 * @param {number} ttl - مدت زمان نگهداری (ثانیه)
 * @returns {boolean} موفقیت عملیات
 */
function setCachedResponse(key, response, cacheType = 'response', ttl = null) {
  try {
    let cache;
    switch (cacheType) {
      case 'user':
        cache = userCache;
        break;
      case 'tax':
        cache = taxCache;
        break;
      default:
        cache = responseCache;
    }

    const success = cache.set(key, response, ttl || CACHE_CONFIG.stdTTL);
    if (success) {
      logger.info(`Cached response for key: ${key.substring(0, 20)}...`);
    }
    return success;
  } catch (error) {
    logger.error('Error setting cached response:', error.message);
    return false;
  }
}

/**
 * حذف یک کلید از cache
 * @param {string} key - کلید برای حذف
 * @param {string} cacheType - نوع cache
 * @returns {boolean} موفقیت عملیات
 */
function deleteCachedResponse(key, cacheType = 'response') {
  try {
    let cache;
    switch (cacheType) {
      case 'user':
        cache = userCache;
        break;
      case 'tax':
        cache = taxCache;
        break;
      default:
        cache = responseCache;
    }

    const deleted = cache.del(key);
    if (deleted > 0) {
      logger.info(`Deleted cached response for key: ${key.substring(0, 20)}...`);
    }
    return deleted > 0;
  } catch (error) {
    logger.error('Error deleting cached response:', error.message);
    return false;
  }
}

/**
 * پاک کردن کل cache
 * @param {string} cacheType - نوع cache
 * @returns {boolean} موفقیت عملیات
 */
function clearCache(cacheType = 'all') {
  try {
    if (cacheType === 'all') {
      responseCache.flushAll();
      userCache.flushAll();
      taxCache.flushAll();
      logger.info('All caches cleared');
    } else {
      let cache;
      switch (cacheType) {
        case 'user':
          cache = userCache;
          break;
        case 'tax':
          cache = taxCache;
          break;
        default:
          cache = responseCache;
      }
      cache.flushAll();
      logger.info(`${cacheType} cache cleared`);
    }
    return true;
  } catch (error) {
    logger.error('Error clearing cache:', error.message);
    return false;
  }
}

/**
 * دریافت آمار cache
 * @param {string} cacheType - نوع cache
 * @returns {object} آمار cache
 */
function getCacheStats(cacheType = 'response') {
  try {
    let cache;
    switch (cacheType) {
      case 'user':
        cache = userCache;
        break;
      case 'tax':
        cache = taxCache;
        break;
      default:
        cache = responseCache;
    }

    const stats = cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
      vsize: stats.vsize
    };
  } catch (error) {
    logger.error('Error getting cache stats:', error.message);
    return null;
  }
}

/**
 * ذخیره اطلاعات کاربر
 * @param {string} userId - شناسه کاربر
 * @param {object} userInfo - اطلاعات کاربر
 * @returns {boolean} موفقیت عملیات
 */
function cacheUserInfo(userId, userInfo) {
  const key = `user_info_${userId}`;
  return setCachedResponse(key, {
    ...userInfo,
    lastSeen: new Date(),
    cacheTime: new Date()
  }, 'user');
}

/**
 * دریافت اطلاعات کاربر
 * @param {string} userId - شناسه کاربر
 * @returns {object|null} اطلاعات کاربر
 */
function getCachedUserInfo(userId) {
  const key = `user_info_${userId}`;
  return getCachedResponse(key, 'user');
}

/**
 * ذخیره نتیجه محاسبه مالیاتی
 * @param {string} userId - شناسه کاربر
 * @param {number} income - درآمد
 * @param {object} result - نتیجه محاسبه
 * @returns {boolean} موفقیت عملیات
 */
function cacheTaxCalculation(userId, income, result) {
  const key = `tax_calc_${userId}_${income}`;
  return setCachedResponse(key, {
    ...result,
    calculationTime: new Date()
  }, 'tax');
}

/**
 * دریافت نتیجه محاسبه مالیاتی
 * @param {string} userId - شناسه کاربر
 * @param {number} income - درآمد
 * @returns {object|null} نتیجه محاسبه
 */
function getCachedTaxCalculation(userId, income) {
  const key = `tax_calc_${userId}_${income}`;
  return getCachedResponse(key, 'tax');
}

/**
 * مدیریت رویدادهای cache
 */
function setupCacheEvents() {
  // رویداد انقضای کلید
  responseCache.on('expired', (key, value) => {
    logger.info(`Cache key expired: ${key.substring(0, 20)}...`);
  });

  // رویداد حذف کلید
  responseCache.on('del', (key, value) => {
    logger.info(`Cache key deleted: ${key.substring(0, 20)}...`);
  });

  // رویداد پر شدن cache
  responseCache.on('set', (key, value) => {
    const stats = getCacheStats();
    if (stats && stats.keys > CACHE_CONFIG.maxKeys * 0.9) {
      logger.warn('Cache is nearly full, consider clearing old entries');
    }
  });
}

// راه‌اندازی رویدادها
setupCacheEvents();

// تابع سازگاری با کد قبلی
function getCacheKey(threadId, text) {
  return generateCacheKey(threadId, text);
}

module.exports = {
  // توابع اصلی
  generateCacheKey,
  getCachedResponse,
  setCachedResponse,
  deleteCachedResponse,
  clearCache,
  getCacheStats,
  
  // توابع تخصصی
  cacheUserInfo,
  getCachedUserInfo,
  cacheTaxCalculation,
  getCachedTaxCalculation,
  
  // سازگاری با کد قبلی
  getCacheKey
};