const logger = require('./logger');

/**
 * ارسال پیام به کاربر در Instagram
 * @param {string} threadId - شناسه thread
 * @param {string} message - متن پیام
 * @param {object} ig - نمونه Instagram client
 */
async function sendMessage(threadId, message, ig) {
  try {
    const thread = ig.entity.directThread(threadId);
    await thread.broadcastText(message);
    logger.logUserInteraction(threadId, 'message_sent', `Length: ${message.length}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send message to ${threadId}:`, error.message);
    return false;
  }
}

/**
 * پاسخ به کامنت در Instagram
 * @param {string} mediaId - شناسه پست
 * @param {string} commentId - شناسه کامنت
 * @param {string} reply - متن پاسخ
 * @param {object} ig - نمونه Instagram client
 */
async function replyToComment(mediaId, commentId, reply, ig) {
  try {
    await ig.media.comment({
      mediaId: mediaId,
      text: reply,
      replyToCommentId: commentId
    });
    logger.logUserInteraction(commentId, 'comment_replied', `MediaID: ${mediaId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to reply to comment ${commentId}:`, error.message);
    return false;
  }
}

/**
 * استخراج اعداد از متن
 * @param {string} text - متن ورودی
 * @returns {number[]} آرایه اعداد یافت شده
 */
function extractNumbers(text) {
  const numbers = text.match(/\d+/g);
  return numbers ? numbers.map(num => parseInt(num.replace(/,/g, ''))) : [];
}

/**
 * تشخیص نوع سوال مالیاتی
 * @param {string} text - متن سوال
 * @returns {object} نوع سوال و پارامترهای استخراج شده
 */
function analyzeTaxQuery(text) {
  const patterns = {
    income_tax: /مالیات\s*(?:درآمد)?\s*(\d+)/i,
    vat: /مالیات\s*(?:بر\s*)?ارزش\s*افزوده\s*(\d+)/i,
    salary_tax: /مالیات\s*حقوق\s*(\d+)/i,
    business_tax: /مالیات\s*(?:کسب\s*و\s*کار|شرکت)\s*(\d+)/i,
    general_question: /چطور|چگونه|راهنمایی|کمک|سوال/i
  };

  const numbers = extractNumbers(text);
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match) {
      return {
        type,
        amount: match[1] ? parseInt(match[1].replace(/,/g, '')) : numbers[0] || null,
        originalText: text,
        confidence: 0.9
      };
    }
  }

  // اگر عدد وجود داشت ولی الگوی خاصی پیدا نشد
  if (numbers.length > 0) {
    return {
      type: 'income_tax',
      amount: numbers[0],
      originalText: text,
      confidence: 0.6
    };
  }

  return {
    type: 'general_question',
    amount: null,
    originalText: text,
    confidence: 0.8
  };
}

/**
 * فرمت کردن اعداد به فارسی
 * @param {number} number - عدد ورودی
 * @returns {string} عدد فرمت شده
 */
function formatPersianNumber(number) {
  return number.toLocaleString('fa-IR');
}

/**
 * تبدیل اعداد انگلیسی به فارسی
 * @param {string} text - متن حاوی اعداد انگلیسی
 * @returns {string} متن با اعداد فارسی
 */
function convertToPersianDigits(text) {
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  let result = text;
  for (let i = 0; i < englishDigits.length; i++) {
    result = result.replace(new RegExp(englishDigits[i], 'g'), persianDigits[i]);
  }
  return result;
}

/**
 * اعتبارسنجی شناسه کاربری Instagram
 * @param {string} userId - شناسه کاربر
 * @returns {boolean} معتبر بودن شناسه
 */
function validateUserId(userId) {
  return userId && typeof userId === 'string' && userId.length > 0;
}

/**
 * محدود کردن طول متن
 * @param {string} text - متن ورودی
 * @param {number} maxLength - حداکثر طول
 * @returns {string} متن محدود شده
 */
function truncateText(text, maxLength = 1000) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * تاخیر زمانی (برای جلوگیری از rate limiting)
 * @param {number} ms - میلی‌ثانیه تاخیر
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * تولید کلید یکتا برای cache
 * @param {string} userId - شناسه کاربر
 * @param {string} query - متن سوال
 * @returns {string} کلید cache
 */
function generateCacheKey(userId, query) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(`${userId}_${query}`).digest('hex');
  return `tax_query_${hash}`;
}

/**
 * بررسی اینکه آیا متن حاوی کلمات نامناسب است
 * @param {string} text - متن ورودی
 * @returns {boolean} وجود کلمات نامناسب
 */
function containsInappropriateContent(text) {
  const inappropriateWords = [
    // می‌توانید کلمات نامناسب را اینجا اضافه کنید
  ];
  
  const lowerText = text.toLowerCase();
  return inappropriateWords.some(word => lowerText.includes(word));
}

/**
 * ایجاد پیام خوشامدگویی
 * @param {string} userName - نام کاربر (اختیاری)
 * @returns {string} پیام خوشامدگویی
 */
function createWelcomeMessage(userName = '') {
  const greeting = userName ? `سلام ${userName}!` : 'سلام!';
  return `${greeting}

🤖 من دستیار مالیاتی هوشمند شما هستم.

📊 قابلیت‌های من:
• محاسبه مالیات درآمد
• پاسخ به سوالات مالیاتی
• راهنمایی در مورد قوانین مالیاتی

💡 نحوه استفاده:
• برای محاسبه مالیات: "مالیات ۱۰۰۰۰۰۰۰"
• برای سوال: مستقیماً سوالتان را بپرسید

🔍 مثال: "مالیات حقوق ۵۰ میلیون چقدر است؟"`;
}

/**
 * ایجاد پیام راهنما
 * @returns {string} پیام راهنما
 */
function createHelpMessage() {
  return `📚 راهنمای استفاده از ربات مالیاتی:

🔢 محاسبه مالیات:
• "مالیات ۱۰۰۰۰۰۰۰" - محاسبه مالیات درآمد
• "مالیات حقوق ۵۰۰۰۰۰۰۰" - محاسبه مالیات حقوق
• "مالیات شرکت ۲۰۰۰۰۰۰۰۰" - محاسبه مالیات شرکت

❓ سوالات عمومی:
• "چطور مالیات محاسبه می‌شود؟"
• "معافیت مالیاتی چیست؟"
• "مهلت ارائه اظهارنامه کی است؟"

⚡ نکات مهم:
• پاسخ‌ها بر اساس آخرین قوانین مالیاتی ایران
• برای دقت بیشتر با مشاور مالیاتی مشورت کنید
• اطلاعات شما محفوظ و امن نگهداری می‌شود`;
}

module.exports = {
  sendMessage,
  replyToComment,
  extractNumbers,
  analyzeTaxQuery,
  formatPersianNumber,
  convertToPersianDigits,
  validateUserId,
  truncateText,
  delay,
  generateCacheKey,
  containsInappropriateContent,
  createWelcomeMessage,
  createHelpMessage
};