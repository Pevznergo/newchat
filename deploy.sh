#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

APP_NAME="ai-chatbot"

echo "🚀 Starting deployment..."

# 0. Pull latest changes
echo "🛑 Resetting local changes to ensure clean pull..."
git reset --hard HEAD
echo "📥 Pulling latest changes from git..."
git pull

# 0.1 Ensure pnpm is installed
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
echo "🧹 Auto-formatting code..."
pnpm run format

echo "🔍 Checking code (Linting)..."
pnpm run lint

# 4. Stop App (Free up RAM)
echo "🛑 Stopping existing process to free up memory..."
pm2 stop "$APP_NAME" || true

# 5. Build & Migrate
echo "🏗️ Building application and migrating database..."
# Optional: Disable telemetry and source maps for lighter build
export NEXT_TELEMETRY_DISABLED=1
export GENERATE_SOURCEMAP=false
pnpm run build

# 6. Start/Restart via PM2
echo "🔄 Managing PM2 process..."

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️ PM2 not found. Installing globally..."
    npm install -g pm2
fi

# Ensure port 3000 is free
echo "🔫 Killing any process on port 3000..."
npx kill-port 3000 || true

if pm2 list | grep -q "$APP_NAME"; then
    echo "♻️ Restarting existing process..."
    pm2 delete "$APP_NAME"
    pm2 start pnpm --name "$APP_NAME" -- start
else
    echo "▶️ Starting new process..."
    # Start using pnpm to ensure proper environment
    pm2 start pnpm --name "$APP_NAME" -- start
fi

# Save PM2 list to serve on reboot (optional)
# pm2 save

echo "✅ Deployment successfully completed!"
