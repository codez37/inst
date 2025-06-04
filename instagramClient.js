const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const { 
  sendMessage, 
  replyToComment, 
  analyzeTaxQuery, 
  delay, 
  validateUserId,
  truncateText,
  createWelcomeMessage,
  createHelpMessage,
  containsInappropriateContent
} = require('./utils');
const config = require('./config');
const { calculateTax, generateTaxReport, calculateIncomeTax } = require('./taxCalculator');
const { askTaxQuestion, getQuickResponse, analyzeSentiment } = require('./openaiService');
const { saveRequest } = require('./dbService');
const { checkUserRateLimit } = require('./rateLimiter');
const { getCachedUserInfo, cacheUserInfo } = require('./cacheService');
const logger = require('./logger');

let ig;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * ورود به Instagram با مدیریت خطا بهتر
 */
async function loginToInstagram() {
  try {
    ig = new IgApiClient();
    ig.state.generateDevice(config.ig.username);

    const sessionPath = config.ig.sessionPath;

    // تلاش برای بارگذاری session موجود
    if (fs.existsSync(sessionPath)) {
      try {
        const savedSession = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        await ig.state.deserialize(savedSession);
        
        // تست اتصال
        await ig.account.currentUser();
        logger.info('Session loaded successfully from file');
        isConnected = true;
        reconnectAttempts = 0;
        return;
      } catch (sessionError) {
        logger.warn('Saved session is invalid, attempting fresh login');
        fs.unlinkSync(sessionPath);
      }
    }

    // ورود جدید
    logger.info('Attempting fresh Instagram login...');
    await ig.account.login(config.ig.username, config.ig.password);
    
    // ذخیره session جدید
    const serialized = await ig.state.serialize();
    fs.writeFileSync(sessionPath, JSON.stringify(serialized), 'utf-8');
    
    logger.info('Successfully logged in and session saved');
    isConnected = true;
    reconnectAttempts = 0;

  } catch (error) {
    logger.error('Instagram login failed:', error.message);
    isConnected = false;
    
    // حذف session معیوب
    if (fs.existsSync(config.ig.sessionPath)) {
      fs.unlinkSync(config.ig.sessionPath);
    }
    
    throw error;
  }
}

/**
 * پردازش پیام‌های دریافتی
 * @param {object} message - پیام دریافتی
 */
async function processDirectMessage(message) {
  const threadId = message.thread_id;
  const text = message.text;
  const userId = message.user_id?.toString() || threadId;

  if (!text || !validateUserId(userId)) {
    logger.warn(`Invalid message or user ID: ${threadId}`);
    return;
  }

  logger.logUserInteraction(userId, 'message_received', `Length: ${text.length}`);

  try {
    // بررسی محدودیت نرخ
    const rateLimitResult = await checkUserRateLimit(userId);
    if (!rateLimitResult.allowed) {
      await sendMessage(threadId, rateLimitResult.message, ig);
      return;
    }

    // بررسی محتوای نامناسب
    if (containsInappropriateContent(text)) {
      logger.warn(`Inappropriate content detected from user ${userId}`);
      await sendMessage(threadId, 'متاسفانه نمی‌توانم به این پیام پاسخ دهم.', ig);
      return;
    }

    // دریافت اطلاعات کاربر از cache
    let userInfo = getCachedUserInfo(userId);
    if (!userInfo) {
      userInfo = {
        userId,
        firstInteraction: new Date(),
        messageCount: 0,
        lastMessageTime: new Date()
      };
    }
    
    userInfo.messageCount++;
    userInfo.lastMessageTime = new Date();
    cacheUserInfo(userId, userInfo);

    // پردازش پیام
    let reply = await processUserMessage(text, userId, userInfo);
    
    // محدود کردن طول پیام
    reply = truncateText(reply, config.ig.maxMessageLength);

    // ارسال پاسخ
    const success = await sendMessage(threadId, reply, ig);
    
    if (success) {
      // ذخیره در دیتابیس
      await saveRequest({ 
        userId, 
        question: text, 
        response: reply,
        messageType: 'direct_message',
        sentiment: analyzeSentiment(text)
      });
      
      logger.logUserInteraction(userId, 'message_processed', 'Success');
    }

    // تاخیر برای جلوگیری از rate limiting
    await delay(config.ig.requestDelay);

  } catch (error) {
    logger.error(`Error processing message from ${userId}:`, error);
    
    try {
      await sendMessage(threadId, 'متاسفانه مشکلی پیش آمد. لطفاً دوباره تلاش کنید.', ig);
    } catch (sendError) {
      logger.error(`Failed to send error message to ${userId}:`, sendError);
    }
  }
}

/**
 * پردازش کامنت‌های دریافتی
 * @param {object} comment - کامنت دریافتی
 */
async function processComment(comment) {
  if (!config.ig.enableCommentReply) return;

  const mediaId = comment.media_id;
  const commentId = comment.pk;
  const text = comment.text;
  const userId = comment.user?.pk?.toString();

  if (!text || !validateUserId(userId)) {
    logger.warn(`Invalid comment or user ID: ${commentId}`);
    return;
  }

  logger.logUserInteraction(userId, 'comment_received', `MediaID: ${mediaId}`);

  try {
    // بررسی محدودیت نرخ
    const rateLimitResult = await checkUserRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return; // نمی‌توانیم پیام خطا در کامنت ارسال کنیم
    }

    // بررسی محتوای نامناسب
    if (containsInappropriateContent(text)) {
      logger.warn(`Inappropriate comment detected from user ${userId}`);
      return;
    }

    // تحلیل سوال
    const queryAnalysis = analyzeTaxQuery(text);
    
    let reply;
    if (queryAnalysis.type === 'income_tax' && queryAnalysis.amount) {
      const result = calculateTax(queryAnalysis.amount);
      reply = `💰 مالیات ${result.income}: ${result.tax} ریال`;
    } else {
      // پاسخ کوتاه برای کامنت‌ها
      reply = 'برای محاسبه دقیق مالیات، لطفاً در DM پیام بدهید 📩';
    }

    // محدود کردن طول پاسخ کامنت
    reply = truncateText(reply, 200); // کامنت‌ها باید کوتاه باشند

    const success = await replyToComment(mediaId, commentId, reply, ig);
    
    if (success) {
      await saveRequest({ 
        userId, 
        question: text, 
        response: reply,
        messageType: 'comment_reply',
        mediaId,
        commentId
      });
      
      logger.logUserInteraction(userId, 'comment_replied', 'Success');
    }

    // تاخیر بیشتر برای کامنت‌ها
    await delay(config.ig.requestDelay * 2);

  } catch (error) {
    logger.error(`Error processing comment from ${userId}:`, error);
  }
}

/**
 * پردازش پیام کاربر و تولید پاسخ
 * @param {string} text - متن پیام
 * @param {string} userId - شناسه کاربر
 * @param {object} userInfo - اطلاعات کاربر
 * @returns {Promise<string>} پاسخ تولید شده
 */
async function processUserMessage(text, userId, userInfo) {
  // بررسی پاسخ‌های سریع
  const quickResponse = getQuickResponse(text);
  if (quickResponse) {
    return quickResponse;
  }

  // پیام خوشامدگویی برای کاربران جدید
  if (userInfo.messageCount === 1) {
    return createWelcomeMessage();
  }

  // دستورات خاص
  if (text.toLowerCase().includes('راهنما') || text.toLowerCase().includes('کمک')) {
    return createHelpMessage();
  }

  // تحلیل سوال مالیاتی
  const queryAnalysis = analyzeTaxQuery(text);
  
  switch (queryAnalysis.type) {
    case 'income_tax':
    case 'salary_tax':
      if (queryAnalysis.amount) {
        if (queryAnalysis.confidence > 0.8) {
          // محاسبه پیشرفته
          const result = calculateIncomeTax(queryAnalysis.amount);
          return generateTaxReport(queryAnalysis.amount);
        } else {
          // محاسبه ساده
          const result = calculateTax(queryAnalysis.amount);
          return `💰 درآمد: ${result.income} ریال\n🧮 مالیات: ${result.tax} ریال\n\n💡 برای محاسبه دقیق‌تر، اطلاعات بیشتری مانند تعداد فرزندان را ذکر کنید.`;
        }
      }
      break;
      
    case 'general_question':
    default:
      // استفاده از هوش مصنوعی
      return await askTaxQuestion(text, userId, {
        previousQuestions: userInfo.previousQuestions || [],
        userType: userInfo.userType || 'individual'
      });
  }

  return 'لطفاً سوال خود را واضح‌تر بیان کنید یا مبلغ درآمد را ذکر کنید.';
}

/**
 * مدیریت اتصال مجدد
 */
async function handleReconnection() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max reconnection attempts reached. Stopping bot.');
    process.exit(1);
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff
  
  logger.info(`Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
  
  setTimeout(async () => {
    try {
      await loginToInstagram();
      await setupEventListeners();
      logger.info('Successfully reconnected to Instagram');
    } catch (error) {
      logger.error('Reconnection failed:', error.message);
      await handleReconnection();
    }
  }, delay);
}

/**
 * راه‌اندازی شنونده‌های رویداد
 */
async function setupEventListeners() {
  if (!ig || !isConnected) {
    throw new Error('Instagram client not connected');
  }

  // شنونده پیام‌های مستقیم
  ig.realtime.on('message', processDirectMessage);

  // شنونده کامنت‌ها (اگر فعال باشد)
  if (config.ig.enableCommentReply) {
    ig.realtime.on('comment', processComment);
  }

  // مدیریت خطاهای اتصال
  ig.realtime.on('error', (error) => {
    logger.error('Instagram realtime error:', error);
    isConnected = false;
    handleReconnection();
  });

  ig.realtime.on('disconnect', () => {
    logger.warn('Instagram realtime disconnected');
    isConnected = false;
    handleReconnection();
  });

  // شروع شنود
  await ig.realtime.connect();
  logger.info('Instagram realtime connected and listening...');
}

/**
 * شروع ربات
 */
async function startBot() {
  try {
    logger.info('Starting Instagram Tax Bot...');
    
    await loginToInstagram();
    await setupEventListeners();
    
    logger.info('Instagram Tax Bot started successfully!');
    
    // نمایش آمار اولیه
    const stats = {
      username: config.ig.username,
      commentReplyEnabled: config.ig.enableCommentReply,
      rateLimitEnabled: config.rateLimit.enableRateLimit,
      maxMessageLength: config.ig.maxMessageLength
    };
    
    logger.info('Bot configuration:', stats);
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    throw error;
  }
}

/**
 * توقف ربات
 */
async function stopBot() {
  try {
    if (ig && isConnected) {
      await ig.realtime.disconnect();
      logger.info('Instagram bot stopped gracefully');
    }
  } catch (error) {
    logger.error('Error stopping bot:', error);
  }
}

// مدیریت خاموشی برنامه
process.on('SIGINT', stopBot);
process.on('SIGTERM', stopBot);

module.exports = { 
  startBot, 
  stopBot, 
  loginToInstagram,
  processDirectMessage,
  processComment
};