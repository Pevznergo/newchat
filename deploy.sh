#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

APP_NAME="ai-chatbot"

echo "🚀 Starting deployment..."

# 1. Clean Cache
echo "🧹 Cleaning cache..."
rm -rf .next
rm -rf node_modules/.cache

# 2. Install Dependencies
echo "📦 Installing dependencies..."
# Use ci if lockfile is present for cleaner install, else install
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

# 3. Check Code (Lint & Type Check)
echo "🔍 Checking code (Linting)..."
npm run lint

# 4. Build & Migrate
# The 'build' script in package.json is: "tsx lib/db/migrate && next build"
# So this handles both migration and building.
echo "🏗️ Building application and migrating database..."
npm run build

# 5. Start/Restart via PM2
echo "🔄 Managing PM2 process..."

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️ PM2 not found. Installing globally..."
    npm install -g pm2
fi

if pm2 list | grep -q "$APP_NAME"; then
    echo "♻️ Restarting existing process..."
    pm2 restart "$APP_NAME"
else
    echo "▶️ Starting new process..."
    pm2 start npm --name "$APP_NAME" -- start
fi

# Save PM2 list to serve on reboot (optional, may require sudo)
# pm2 save

echo "✅ Deployment successfully completed!"
