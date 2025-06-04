# 🚀 راهنمای Deploy

این راهنما مراحل deploy کردن Instagram Tax Bot را در پلتفرم‌های مختلف توضیح می‌دهد.

## 📋 پیش‌نیازها

### متغیرهای محیطی ضروری
```env
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password
MONGODB_URI=mongodb://localhost:27017/taxbotdb
OPENAI_API_KEY=sk-your-openai-api-key
```

### متغیرهای اختیاری
```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
IG_ENABLE_COMMENT_REPLY=true
ENABLE_RATE_LIMIT=true
ENABLE_HEALTH_CHECK=true
```

## 🐳 Docker Deployment

### 1. Build کردن Image
```bash
docker build -t instagram-tax-bot .
```

### 2. اجرا با Docker Run
```bash
docker run -d \
  --name instagram-tax-bot \
  -p 3000:3000 \
  -e IG_USERNAME=your_username \
  -e IG_PASSWORD=your_password \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/taxbotdb \
  -e OPENAI_API_KEY=your_openai_key \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/session.json:/app/session.json \
  --restart unless-stopped \
  instagram-tax-bot
```

### 3. اجرا با Docker Compose
```bash
# کپی کردن فایل environment
cp .env.example .env
# ویرایش .env با اطلاعات واقعی

# اجرای services
docker-compose up -d

# مشاهده logs
docker-compose logs -f instagram-tax-bot

# اجرا با MongoDB admin panel
docker-compose --profile admin up -d
```

## ☁️ Cloud Deployment

### Render.com

1. **ایجاد Web Service جدید**
   - Repository: لینک GitHub repo
   - Branch: main
   - Build Command: `npm install`
   - Start Command: `node app.js`

2. **تنظیم Environment Variables**
   ```
   IG_USERNAME=your_username
   IG_PASSWORD=your_password
   MONGODB_URI=your_mongodb_atlas_uri
   OPENAI_API_KEY=your_openai_key
   NODE_ENV=production
   PORT=3000
   ```

3. **تنظیم Health Check**
   - Health Check Path: `/health`

### Railway

1. **Deploy از GitHub**
   ```bash
   railway login
   railway link
   railway up
   ```

2. **تنظیم متغیرها**
   ```bash
   railway variables set IG_USERNAME=your_username
   railway variables set IG_PASSWORD=your_password
   railway variables set MONGODB_URI=your_mongodb_uri
   railway variables set OPENAI_API_KEY=your_openai_key
   ```

### Heroku

1. **ایجاد app**
   ```bash
   heroku create your-app-name
   ```

2. **تنظیم متغیرها**
   ```bash
   heroku config:set IG_USERNAME=your_username
   heroku config:set IG_PASSWORD=your_password
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set OPENAI_API_KEY=your_openai_key
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### DigitalOcean App Platform

1. **ایجاد App از GitHub**
2. **تنظیم Environment Variables**
3. **تنظیم Health Check**: `/health`

## 🗄️ Database Setup

### MongoDB Atlas (توصیه شده برای production)

1. **ایجاد Cluster**
   - ثبت نام در [MongoDB Atlas](https://cloud.mongodb.com)
   - ایجاد cluster رایگان
   - تنظیم IP whitelist
   - ایجاد database user

2. **دریافت Connection String**
   ```
   mongodb+srv://username:password@cluster.mongodb.net/taxbotdb?retryWrites=true&w=majority
   ```

### MongoDB محلی
```bash
# نصب MongoDB
# Ubuntu/Debian
sudo apt-get install mongodb

# macOS
brew install mongodb-community

# اجرا
mongod --dbpath /path/to/data
```

## 🔧 تنظیمات Production

### 1. امنیت
```env
# فعال کردن rate limiting
ENABLE_RATE_LIMIT=true
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW=60000

# فعال کردن content filter
ENABLE_CONTENT_FILTER=true
BLOCK_INAPPROPRIATE=true
```

### 2. Performance
```env
# تنظیم cache
CACHE_TTL=3600
CACHE_MAX_KEYS=1000

# تنظیم MongoDB
MONGO_MAX_POOL_SIZE=10
MONGO_TIMEOUT=5000
```

### 3. Monitoring
```env
# فعال کردن metrics
ENABLE_METRICS=true
ENABLE_HEALTH_CHECK=true
LOG_LEVEL=info
```

## 📊 Monitoring و Troubleshooting

### Health Check Endpoints
```bash
# بررسی سلامت
curl https://your-app.com/health

# بررسی آمار
curl https://your-app.com/metrics

# بررسی تنظیمات
curl https://your-app.com/config
```

### مشاهده Logs
```bash
# Docker
docker logs instagram-tax-bot -f

# Docker Compose
docker-compose logs -f instagram-tax-bot

# Heroku
heroku logs --tail

# Railway
railway logs
```

### مشکلات رایج

#### 1. خطای Instagram Login
```
Error: Instagram login failed
```
**راه حل:**
- بررسی username/password
- حذف session.json
- استفاده از VPN
- بررسی two-factor authentication

#### 2. خطای MongoDB
```
Error: MongoDB connection failed
```
**راه حل:**
- بررسی connection string
- بررسی network access در Atlas
- بررسی database user permissions

#### 3. خطای OpenAI
```
Error: OpenAI API failed
```
**راه حل:**
- بررسی API key
- بررسی credit باقی‌مانده
- بررسی rate limits

#### 4. Memory Issues
```
Error: JavaScript heap out of memory
```
**راه حل:**
- افزایش memory limit
- بهینه‌سازی cache
- پاک‌سازی logs قدیمی

## 🔄 CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Render
        uses: render-deploy/action@v1
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}
```

## 📈 Scaling

### Horizontal Scaling
- استفاده از load balancer
- چندین instance از bot
- shared MongoDB
- shared cache (Redis)

### Vertical Scaling
- افزایش CPU/Memory
- بهینه‌سازی database queries
- بهبود cache strategy

## 🔒 Security Best Practices

1. **Environment Variables**
   - هرگز credentials را در کد commit نکنید
   - استفاده از secrets management

2. **Network Security**
   - محدود کردن database access
   - استفاده از HTTPS
   - تنظیم firewall rules

3. **Application Security**
   - فعال کردن rate limiting
   - validation ورودی‌ها
   - logging تمام activities

4. **Instagram Security**
   - استفاده از session management
   - respect کردن rate limits
   - monitoring unusual activities

---

💡 **نکته**: همیشه ابتدا در محیط development تست کنید و سپس به production deploy کنید.