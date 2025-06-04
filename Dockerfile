# استفاده از Node.js LTS
FROM node:18-alpine

# تنظیم متغیر محیطی
ENV NODE_ENV=production

# ایجاد دایرکتری کاری
WORKDIR /app

# کپی کردن package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# نصب pnpm (اختیاری)
RUN npm install -g pnpm

# نصب dependencies
RUN pnpm install --frozen-lockfile --prod

# کپی کردن کد برنامه
COPY . .

# ایجاد دایرکتری logs
RUN mkdir -p logs

# تنظیم مجوزها
RUN chown -R node:node /app
USER node

# تنظیم health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# expose کردن port
EXPOSE 3000

# دستور اجرا
CMD ["node", "app.js"]