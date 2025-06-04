FROM node:18-alpine

WORKDIR /app

# کپی package.json و نصب dependencies
COPY package.json .
RUN npm install --production

# کپی کد برنامه
COPY . .

# ایجاد دایرکتری logs
RUN mkdir -p logs

EXPOSE 3000

CMD ["node", "app.js"]