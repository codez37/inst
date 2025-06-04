const OpenAI = require("openai");
const config = require('./config');
const logger = require('./logger');
const { getCachedResponse, setCachedResponse, generateCacheKey } = require('./utils');

// ایجاد نمونه OpenAI با API جدید
const openai = new OpenAI({
  apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY,
});

// تنظیمات پیشرفته
const AI_CONFIG = {
  model: "gpt-3.5-turbo",
  maxTokens: 1000,
  temperature: 0.7,
  topP: 0.9,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1
};

// سیستم پرامپت پیشرفته
const SYSTEM_PROMPT = `تو یک مشاور مالیاتی حرفه‌ای و متخصص در قوانین مالیاتی ایران هستی.

ویژگی‌های تو:
- دانش کامل از قانون مالیات‌های مستقیم ایران
- آشنایی با آخرین تغییرات و بخشنامه‌های سازمان امور مالیاتی
- توانایی محاسبه دقیق انواع مالیات‌ها
- ارائه راهنمایی‌های عملی و قابل فهم

قوانین پاسخ‌دهی:
1. همیشه بر اساس قوانین رسمی ایران پاسخ بده
2. اگر مطمئن نیستی، این موضوع را ذکر کن
3. پاسخ‌ها را ساده و قابل فهم ارائه بده
4. در صورت نیاز، مثال عملی بزن
5. اگر سوال خارج از حوزه مالیات است، کاربر را راهنمایی کن

نرخ‌های مالیاتی فعلی (1403):
- تا 5 میلیون: معاف
- 5 تا 10 میلیون: 10%
- 10 تا 20 میلیون: 20%
- بالای 20 میلیون: 30%`;

/**
 * پرسش سوال مالیاتی از هوش مصنوعی
 * @param {string} question - سوال کاربر
 * @param {string} userId - شناسه کاربر
 * @param {object} context - اطلاعات اضافی
 * @returns {Promise<string>} پاسخ هوش مصنوعی
 */
async function askTaxQuestion(question, userId = '', context = {}) {
  const startTime = Date.now();
  
  try {
    // بررسی cache
    const { generateCacheKey } = require('./cacheService');
    const cacheKey = generateCacheKey(userId, question);
    const cachedResponse = getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      logger.info(`Cache hit for user ${userId}`);
      return cachedResponse;
    }

    // ایجاد پرامپت کاربر
    const userPrompt = createUserPrompt(question, context);
    
    // فراخوانی API
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      top_p: AI_CONFIG.topP,
      frequency_penalty: AI_CONFIG.frequencyPenalty,
      presence_penalty: AI_CONFIG.presencePenalty
    });

    const answer = response.choices[0].message.content;
    const duration = Date.now() - startTime;
    
    // ذخیره در cache
    setCachedResponse(cacheKey, answer);
    
    // لاگ موفقیت
    logger.logAPICall('OpenAI', 'chat.completions', duration, true);
    logger.logUserInteraction(userId, 'ai_question', `Question length: ${question.length}`);
    
    return answer;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAPICall('OpenAI', 'chat.completions', duration, false);
    logger.error("OpenAI API Error:", error);
    
    // پاسخ‌های جایگزین بر اساس نوع خطا
    return handleAIError(error, question);
  }
}

/**
 * ایجاد پرامپت کاربر
 * @param {string} question - سوال اصلی
 * @param {object} context - اطلاعات اضافی
 * @returns {string} پرامپت نهایی
 */
function createUserPrompt(question, context = {}) {
  let prompt = `سوال کاربر: "${question}"`;
  
  if (context.previousQuestions && context.previousQuestions.length > 0) {
    prompt += `\n\nسوالات قبلی کاربر:\n${context.previousQuestions.join('\n')}`;
  }
  
  if (context.userType) {
    prompt += `\n\nنوع کاربر: ${context.userType}`;
  }
  
  prompt += `\n\nلطفاً پاسخ جامع و دقیق ارائه بده. اگر نیاز به محاسبه است، مراحل را نشان بده.`;
  
  return prompt;
}

/**
 * مدیریت خطاهای API
 * @param {Error} error - خطای رخ داده
 * @param {string} question - سوال اصلی
 * @returns {string} پاسخ جایگزین
 */
function handleAIError(error, question) {
  // خطاهای مربوط به محدودیت نرخ
  if (error.status === 429) {
    return "تعداد درخواست‌ها زیاد است. لطفاً چند دقیقه صبر کنید و دوباره تلاش کنید.";
  }
  
  // خطاهای مربوط به API key
  if (error.status === 401) {
    return "مشکلی در تنظیمات سیستم وجود دارد. لطفاً با پشتیبانی تماس بگیرید.";
  }
  
  // خطاهای مربوط به محتوا
  if (error.status === 400) {
    return "متاسفانه نمی‌توانم به این سوال پاسخ دهم. لطفاً سوال خود را بازنویسی کنید.";
  }
  
  // سایر خطاها
  return "متاسفانه در حال حاضر مشکلی در سیستم وجود دارد. لطفاً بعداً تلاش کنید.";
}

/**
 * تولید پاسخ سریع برای سوالات رایج
 * @param {string} question - سوال کاربر
 * @returns {string|null} پاسخ سریع یا null
 */
function getQuickResponse(question) {
  const quickResponses = {
    'سلام': 'سلام! چطور می‌تونم کمکتون کنم؟',
    'ممنون': 'خواهش می‌کنم! اگر سوال دیگه‌ای دارید، بپرسید.',
    'راهنمایی': 'برای محاسبه مالیات، درآمدتون رو بنویسید. مثل: "مالیات ۱۰۰۰۰۰۰۰"',
    'کمک': 'چطور می‌تونم کمکتون کنم؟ می‌تونید سوال مالیاتی‌تون رو بپرسید.'
  };
  
  const lowerQuestion = question.toLowerCase().trim();
  
  for (const [key, response] of Object.entries(quickResponses)) {
    if (lowerQuestion.includes(key)) {
      return response;
    }
  }
  
  return null;
}

/**
 * تحلیل احساسات کاربر
 * @param {string} text - متن کاربر
 * @returns {string} نوع احساس
 */
function analyzeSentiment(text) {
  const positiveWords = ['ممنون', 'متشکر', 'عالی', 'خوب', 'مفید'];
  const negativeWords = ['بد', 'مشکل', 'نمی‌فهمم', 'پیچیده', 'سخت'];
  
  const lowerText = text.toLowerCase();
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

module.exports = { 
  askTaxQuestion, 
  getQuickResponse, 
  analyzeSentiment 
};

module.exports = { askTaxQuestion };