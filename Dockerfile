# استفاده از Node.js LTS
FROM node:18-alpine

# تنظیم متغیر محیطی
ENV NODE_ENV=production

# نصب ابزارهای ضروری
RUN apk add --no-cache curl

# ایجاد دایرکتری کاری
WORKDIR /app

# کپی کردن package files
COPY package*.json ./

# نصب dependencies با npm (بجای pnpm برای سادگی)
RUN npm ci --only=production

# کپی کردن کد برنامه
COPY . .

# ایجاد دایرکتری logs و تنظیم مجوزها
RUN mkdir -p logs && \
    chmod +x docker-healthcheck.js && \
    chmod +x start.sh && \
    chown -R node:node /app

# تغییر به کاربر node
USER node

# تنظیم health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node docker-healthcheck.js

# expose کردن port
EXPOSE 3000

# دستور اجرا
CMD ["./start.sh"]