const winston = require('winston');
const path = require('path');

// تنظیمات فرمت لاگ
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// ایجاد logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // لاگ در کنسول
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // لاگ در فایل برای خطاها
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // لاگ در فایل برای همه سطوح
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // مدیریت خطاهای logger خودش
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'rejections.log')
    })
  ]
});

// اضافه کردن متدهای کمکی
logger.logUserInteraction = (userId, action, details = '') => {
  logger.info(`User Interaction - UserID: ${userId}, Action: ${action}, Details: ${details}`);
};

logger.logTaxCalculation = (userId, income, tax) => {
  logger.info(`Tax Calculation - UserID: ${userId}, Income: ${income}, Tax: ${tax}`);
};

logger.logAPICall = (service, endpoint, duration, success = true) => {
  const level = success ? 'info' : 'warn';
  logger[level](`API Call - Service: ${service}, Endpoint: ${endpoint}, Duration: ${duration}ms, Success: ${success}`);
};

module.exports = logger;