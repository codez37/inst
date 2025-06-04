require('dotenv').config();

module.exports = {
  // تنظیمات Instagram
  ig: {
    username: process.env.IG_USERNAME,
    password: process.env.IG_PASSWORD,
    sessionPath: process.env.SESSION_PATH || './session.json',
    // تنظیمات جدید برای بهبود عملکرد
    requestDelay: parseInt(process.env.IG_REQUEST_DELAY) || 2000, // تاخیر بین درخواست‌ها (میلی‌ثانیه)
    maxRetries: parseInt(process.env.IG_MAX_RETRIES) || 3,
    enableCommentReply: process.env.IG_ENABLE_COMMENT_REPLY === 'true',
    enableStoryReply: process.env.IG_ENABLE_STORY_REPLY === 'true',
    maxMessageLength: parseInt(process.env.IG_MAX_MESSAGE_LENGTH) || 1000
  },

  // تنظیمات OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000 // 30 ثانیه
  },

  // تنظیمات Hugging Face (برای آینده)
  hf: {
    model: process.env.HF_MODEL,
    token: process.env.HF_API_TOKEN,
    endpoint: process.env.HF_ENDPOINT
  },

  // تنظیمات MongoDB
  mongo: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT) || 45000,
    }
  },

  // تنظیمات Cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 ساعت
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000,
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600 // 10 دقیقه
  },

  // تنظیمات Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 دقیقه
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 10, // 10 درخواست در دقیقه
    enableRateLimit: process.env.ENABLE_RATE_LIMIT === 'true'
  },

  // تنظیمات عمومی
  app: {
    port: parseInt(process.env.PORT) || 3000,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === 'true'
  },

  // تنظیمات امنیتی
  security: {
    enableContentFilter: process.env.ENABLE_CONTENT_FILTER === 'true',
    maxMessagePerUser: parseInt(process.env.MAX_MESSAGE_PER_USER) || 50, // در روز
    blockInappropriateContent: process.env.BLOCK_INAPPROPRIATE === 'true',
    enableUserBlacklist: process.env.ENABLE_USER_BLACKLIST === 'true'
  },

  // تنظیمات مالیاتی
  tax: {
    currentYear: parseInt(process.env.TAX_YEAR) || 1403,
    enableAdvancedCalculations: process.env.ENABLE_ADVANCED_TAX === 'true',
    enableTaxReports: process.env.ENABLE_TAX_REPORTS === 'true',
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'IRR'
  }
};