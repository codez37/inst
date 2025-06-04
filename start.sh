#!/bin/sh

# Start script برای Docker container

echo "🚀 Starting Instagram Tax Bot..."

# بررسی متغیرهای محیطی ضروری
if [ -z "$IG_USERNAME" ]; then
    echo "❌ Error: IG_USERNAME environment variable is required"
    exit 1
fi

if [ -z "$IG_PASSWORD" ]; then
    echo "❌ Error: IG_PASSWORD environment variable is required"
    exit 1
fi

if [ -z "$MONGODB_URI" ]; then
    echo "❌ Error: MONGODB_URI environment variable is required"
    exit 1
fi

# تنظیم متغیرهای پیش‌فرض
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export LOG_LEVEL=${LOG_LEVEL:-info}

echo "✅ Environment variables validated"
echo "📊 Node Environment: $NODE_ENV"
echo "🔌 Port: $PORT"
echo "📝 Log Level: $LOG_LEVEL"

# شروع برنامه
echo "🎯 Starting application..."
exec node app.js