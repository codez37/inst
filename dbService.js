const mongoose = require('mongoose');
const TaxRequest = require('./models/TaxRequest');
const config = require('./config');
const logger = require('./logger');

let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

/**
 * اتصال به MongoDB با مدیریت خطا بهتر
 */
async function connectDB() {
  try {
    if (isConnected) {
      logger.info('Already connected to MongoDB');
      return;
    }

    logger.info('Connecting to MongoDB...');
    
    await mongoose.connect(config.mongo.uri, config.mongo.options);
    
    isConnected = true;
    connectionAttempts = 0;
    
    logger.info('Successfully connected to MongoDB');
    
    // راه‌اندازی event listeners
    setupMongoEventListeners();
    
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    isConnected = false;
    
    connectionAttempts++;
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      logger.error('Max MongoDB connection attempts reached. Exiting...');
      process.exit(1);
    }
    
    // تلاش مجدد با تاخیر
    const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
    logger.info(`Retrying MongoDB connection in ${delay}ms (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
    
    setTimeout(connectDB, delay);
  }
}

/**
 * راه‌اندازی شنونده‌های رویداد MongoDB
 */
function setupMongoEventListeners() {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
    isConnected = true;
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB error:', error);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    isConnected = false;
    
    // تلاش برای اتصال مجدد
    setTimeout(connectDB, 5000);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
    isConnected = true;
  });
}

/**
 * ذخیره درخواست کاربر
 * @param {object} data - اطلاعات درخواست
 * @returns {Promise<object>} درخواست ذخیره شده
 */
async function saveRequest(data) {
  try {
    if (!isConnected) {
      logger.warn('MongoDB not connected, attempting to reconnect...');
      await connectDB();
    }

    const requestData = {
      ...data,
      timestamp: new Date(),
      processed: true
    };

    const req = new TaxRequest(requestData);
    const savedRequest = await req.save();
    
    logger.info(`Request saved for user ${data.userId}`);
    return savedRequest;
    
  } catch (error) {
    logger.error('Error saving request:', error.message);
    
    // در صورت خطا، حداقل لاگ کنیم
    logger.info('Request data (not saved):', {
      userId: data.userId,
      questionLength: data.question?.length || 0,
      responseLength: data.response?.length || 0,
      messageType: data.messageType || 'unknown'
    });
    
    throw error;
  }
}

/**
 * دریافت تاریخچه درخواست‌های کاربر
 * @param {string} userId - شناسه کاربر
 * @param {number} limit - تعداد درخواست‌ها
 * @returns {Promise<Array>} لیست درخواست‌ها
 */
async function getUserHistory(userId, limit = 10) {
  try {
    if (!isConnected) {
      await connectDB();
    }

    const requests = await TaxRequest
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('question response timestamp messageType sentiment')
      .lean();

    logger.info(`Retrieved ${requests.length} requests for user ${userId}`);
    return requests;
    
  } catch (error) {
    logger.error('Error getting user history:', error.message);
    return [];
  }
}

/**
 * دریافت آمار کلی
 * @param {object} filters - فیلترهای جستجو
 * @returns {Promise<object>} آمار
 */
async function getStats(filters = {}) {
  try {
    if (!isConnected) {
      await connectDB();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const [
      totalRequests,
      todayRequests,
      yesterdayRequests,
      weekRequests,
      uniqueUsers,
      messageTypes,
      sentimentStats
    ] = await Promise.all([
      TaxRequest.countDocuments(filters),
      TaxRequest.countDocuments({ ...filters, timestamp: { $gte: today } }),
      TaxRequest.countDocuments({ 
        ...filters, 
        timestamp: { $gte: yesterday, $lt: today } 
      }),
      TaxRequest.countDocuments({ ...filters, timestamp: { $gte: lastWeek } }),
      TaxRequest.distinct('userId', filters),
      TaxRequest.aggregate([
        { $match: filters },
        { $group: { _id: '$messageType', count: { $sum: 1 } } }
      ]),
      TaxRequest.aggregate([
        { $match: filters },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      totalRequests,
      todayRequests,
      yesterdayRequests,
      weekRequests,
      uniqueUsers: uniqueUsers.length,
      messageTypes: messageTypes.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {}),
      sentimentStats: sentimentStats.reduce((acc, item) => {
        acc[item._id || 'neutral'] = item.count;
        return acc;
      }, {}),
      averageRequestsPerUser: uniqueUsers.length > 0 ? 
        (totalRequests / uniqueUsers.length).toFixed(2) : 0
    };

    logger.info('Database stats retrieved:', stats);
    return stats;
    
  } catch (error) {
    logger.error('Error getting stats:', error.message);
    return {
      totalRequests: 0,
      todayRequests: 0,
      yesterdayRequests: 0,
      weekRequests: 0,
      uniqueUsers: 0,
      messageTypes: {},
      sentimentStats: {},
      averageRequestsPerUser: 0
    };
  }
}

/**
 * جستجو در درخواست‌ها
 * @param {object} query - پارامترهای جستجو
 * @returns {Promise<Array>} نتایج جستجو
 */
async function searchRequests(query) {
  try {
    if (!isConnected) {
      await connectDB();
    }

    const {
      userId,
      messageType,
      sentiment,
      dateFrom,
      dateTo,
      searchText,
      limit = 50,
      skip = 0
    } = query;

    let mongoQuery = {};

    if (userId) mongoQuery.userId = userId;
    if (messageType) mongoQuery.messageType = messageType;
    if (sentiment) mongoQuery.sentiment = sentiment;
    
    if (dateFrom || dateTo) {
      mongoQuery.timestamp = {};
      if (dateFrom) mongoQuery.timestamp.$gte = new Date(dateFrom);
      if (dateTo) mongoQuery.timestamp.$lte = new Date(dateTo);
    }

    if (searchText) {
      mongoQuery.$or = [
        { question: { $regex: searchText, $options: 'i' } },
        { response: { $regex: searchText, $options: 'i' } }
      ];
    }

    const requests = await TaxRequest
      .find(mongoQuery)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await TaxRequest.countDocuments(mongoQuery);

    logger.info(`Search completed: ${requests.length} results found`);
    
    return {
      requests,
      total,
      hasMore: (skip + limit) < total
    };
    
  } catch (error) {
    logger.error('Error searching requests:', error.message);
    return { requests: [], total: 0, hasMore: false };
  }
}

/**
 * حذف درخواست‌های قدیمی
 * @param {number} daysOld - تعداد روزهای قدیمی
 * @returns {Promise<number>} تعداد درخواست‌های حذف شده
 */
async function cleanupOldRequests(daysOld = 90) {
  try {
    if (!isConnected) {
      await connectDB();
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await TaxRequest.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logger.info(`Cleaned up ${result.deletedCount} old requests (older than ${daysOld} days)`);
    return result.deletedCount;
    
  } catch (error) {
    logger.error('Error cleaning up old requests:', error.message);
    return 0;
  }
}

/**
 * بررسی وضعیت اتصال
 * @returns {boolean} وضعیت اتصال
 */
function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * قطع اتصال از دیتابیس
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error.message);
  }
}

// مدیریت خاموشی برنامه
process.on('SIGINT', disconnectDB);
process.on('SIGTERM', disconnectDB);

module.exports = { 
  connectDB, 
  saveRequest,
  getUserHistory,
  getStats,
  searchRequests,
  cleanupOldRequests,
  isDBConnected,
  disconnectDB
};