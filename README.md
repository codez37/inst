# 🤖 Instagram Tax Bot

ربات هوشمند مالیاتی برای Instagram که قابلیت محاسبه مالیات و پاسخ به سوالات مالیاتی را دارد.

## ✨ ویژگی‌ها

### 🧮 محاسبات مالیاتی
- محاسبه مالیات درآمد اشخاص حقیقی
- محاسبه مالیات حقوق (ماهانه و سالانه)
- محاسبه مالیات شرکت‌ها
- محاسبه مالیات بر ارزش افزوده (VAT)
- در نظر گیری معافیت‌های مختلف (همسر، فرزند، سالمندی، معلولیت)

### 📱 قابلیت‌های Instagram
- پاسخ به پیام‌های مستقیم (DM)
- پاسخ به کامنت‌ها (قابل فعال/غیرفعال کردن)
- مدیریت session برای اتصال پایدار
- Rate limiting برای جلوگیری از spam

### 🤖 هوش مصنوعی
- استفاده از OpenAI GPT برای پاسخ به سوالات پیچیده
- تحلیل احساسات کاربران
- پاسخ‌های سریع برای سوالات رایج
- Cache کردن پاسخ‌ها برای بهبود سرعت

### 📊 مدیریت داده
- ذخیره تاریخچه مکالمات در MongoDB
- آمارگیری از تعاملات کاربران
- پاک‌سازی خودکار داده‌های قدیمی
- جستجو در تاریخچه درخواست‌ها

### 🛡️ امنیت و کیفیت
- Rate limiting برای محدود کردن درخواست‌ها
- فیلتر محتوای نامناسب
- مدیریت خطاها و reconnection خودکار
- لاگ‌گیری کامل از تمام فعالیت‌ها

### 📈 نظارت و مدیریت
- Health check endpoints
- آمار عملکرد real-time
- Dashboard مدیریتی
- Graceful shutdown

## 🚀 نصب و راه‌اندازی

### پیش‌نیازها
- Node.js 16 یا بالاتر
- MongoDB
- حساب Instagram
- کلید API OpenAI

### مراحل نصب

1. **کلون کردن پروژه**
```bash
git clone <repository-url>
cd instagram-tax-bot
```

2. **نصب dependencies**
```bash
npm install
# یا
pnpm install
```

3. **تنظیم متغیرهای محیطی**
فایل `.env` را ایجاد کنید:
```env
# Instagram
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password
SESSION_PATH=./session.json

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# MongoDB
MONGODB_URI=mongodb://localhost:27017/taxbotdb

# تنظیمات اختیاری
NODE_ENV=development
LOG_LEVEL=info
PORT=3000

# Instagram Features
IG_ENABLE_COMMENT_REPLY=true
IG_ENABLE_STORY_REPLY=false
IG_MAX_MESSAGE_LENGTH=1000
IG_REQUEST_DELAY=2000

# Rate Limiting
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10

# Features
ENABLE_METRICS=true
ENABLE_HEALTH_CHECK=true
ENABLE_ADVANCED_TAX=true
```

4. **راه‌اندازی MongoDB**
```bash
# اگر MongoDB محلی دارید
mongod

# یا استفاده از Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

5. **اجرای ربات**
```bash
npm start
# یا برای development
npm run dev
```

## 📖 نحوه استفاده

### برای کاربران Instagram

#### محاسبه مالیات ساده
```
مالیات 10000000
```

#### محاسبه مالیات حقوق
```
مالیات حقوق 50000000
```

#### سوالات عمومی
```
چطور مالیات محاسبه می‌شود؟
معافیت مالیاتی چیست؟
مهلت ارائه اظهارنامه کی است؟
```

#### دریافت راهنما
```
راهنما
کمک
```

### API Endpoints

#### Health Check
```
GET /health - وضعیت سلامت سیستم
GET /ready - آمادگی سیستم
GET /metrics - آمار عملکرد
GET /config - تنظیمات (بدون اطلاعات حساس)
```

#### مدیریت
```
POST /admin/cache/clear - پاک کردن cache
POST /admin/ratelimit/reset - ریست rate limit کاربر
```

## 🏗️ ساختار پروژه

```
instagram-tax-bot/
├── app.js                 # فایل اصلی برنامه
├── config.js              # تنظیمات
├── logger.js              # سیستم لاگ
├── utils.js               # توابع کمکی
├── instagramClient.js     # کلاینت Instagram
├── openaiService.js       # سرویس OpenAI
├── taxCalculator.js       # محاسبه‌گر مالیات
├── dbService.js           # سرویس دیتابیس
├── cacheService.js        # سرویس Cache
├── rateLimiter.js         # محدودکننده نرخ
├── healthCheck.js         # Health check server
├── languageService.js     # سرویس زبان
├── models/
│   └── TaxRequest.js      # مدل درخواست مالیاتی
├── logs/                  # فایل‌های لاگ
├── .env                   # متغیرهای محیطی (ایجاد کنید)
├── .gitignore            # فایل‌های نادیده گرفته شده
├── package.json          # Dependencies
└── README.md             # مستندات
```

## 🔧 تنظیمات پیشرفته

### Rate Limiting
```env
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW=60000    # 1 دقیقه
RATE_LIMIT_MAX=10          # 10 درخواست در دقیقه
```

### Cache
```env
CACHE_TTL=3600             # 1 ساعت
CACHE_MAX_KEYS=1000        # حداکثر 1000 کلید
```

### Instagram
```env
IG_REQUEST_DELAY=2000      # 2 ثانیه تاخیر بین درخواست‌ها
IG_MAX_RETRIES=3           # حداکثر 3 تلاش مجدد
```

## 📊 نظارت

### لاگ‌ها
لاگ‌ها در پوشه `logs/` ذخیره می‌شوند:
- `error.log` - خطاها
- `combined.log` - تمام لاگ‌ها
- `exceptions.log` - خطاهای غیرمنتظره

### آمار
```bash
curl http://localhost:3000/metrics
```

### Health Check
```bash
curl http://localhost:3000/health
```

## 🛠️ توسعه

### اضافه کردن ویژگی جدید
1. فایل مربوطه را ویرایش کنید
2. تست‌های لازم را اضافه کنید
3. مستندات را به‌روزرسانی کنید

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## 🚨 عیب‌یابی

### مشکلات رایج

#### خطای اتصال Instagram
- بررسی کنید username و password صحیح باشد
- فایل session.json را حذف کنید
- VPN استفاده کنید اگر IP مسدود شده

#### خطای MongoDB
- بررسی کنید MongoDB در حال اجرا باشد
- connection string را بررسی کنید

#### خطای OpenAI
- کلید API را بررسی کنید
- credit باقی‌مانده را چک کنید

### لاگ‌ها
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

## 📝 مجوز

این پروژه تحت مجوز MIT منتشر شده است.

## 🤝 مشارکت

برای مشارکت در پروژه:
1. Fork کنید
2. Branch جدید ایجاد کنید
3. تغییرات را commit کنید
4. Pull Request ارسال کنید

## 📞 پشتیبانی

برای گزارش مشکل یا درخواست ویژگی جدید، از Issues استفاده کنید.

---

**نکته مهم**: این ربات صرفاً جهت اطلاع‌رسانی است و نباید جایگزین مشاوره حرفه‌ای مالیاتی شود.