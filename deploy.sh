#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

APP_NAME="ai-chatbot"

echo "🚀 Starting deployment..."

# 0. Ensure pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "⚠️ pnpm not found. Installing globally..."
    npm install -g pnpm
fi

# 1. Clean Cache
echo "🧹 Cleaning cache..."
rm -rf .next
rm -rf node_modules/.cache

# 2. Install Dependencies
echo "📦 Installing dependencies..."
# pnpm install will use the lockfile automatically
pnpm install

# 3. Check Code (Lint & Type Check)
echo "🔍 Checking code (Linting)..."
pnpm run lint

# 4. Build & Migrate
echo "🏗️ Building application and migrating database..."
pnpm run build

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
    # Start using pnpm to ensure proper environment
    pm2 start pnpm --name "$APP_NAME" -- start
fi

# Save PM2 list to serve on reboot (optional)
# pm2 save

echo "✅ Deployment successfully completed!"
