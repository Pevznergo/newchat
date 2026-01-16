#!/bin/bash
set -e

SERVER="root@70.34.255.16"
REMOTE_DIR="/var/www/app.aporto.tech"
SSH_KEY="/Users/igortkachenko/.ssh/vast_id_ed25519"

echo "🚀 Starting deployment via Local Build..."

# 1. Clean Local Build
echo "🧹 Cleaning local build..."
rm -rf .next
rm -rf node_modules/.cache

# 2. Build Locally
echo "🏗️ Building application locally (this might take a minute)..."
# Ensure dependencies are installed locally
if [ ! -d "node_modules" ]; then
    echo "📦 Installing local dependencies..."
    pnpm install
fi

# Run lint and format to be safe (optional, can skip for speed if sure)
# pnpm run lint 
pnpm run build

echo "✅ Local build successful."

# 3. Prepare Remote Directory
echo "📂 Preparing remote directory..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR"

# 4. Sync Files via RSYNC
echo "📡 Uploading files to server..."
# Exclude node_modules (too big, better installed on server), .git, .env (local)
# We upload .next (the build), public, package.json, next.config.ts, etc.
rsync -avz -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude '.DS_Store' \
    ./ "$SERVER:$REMOTE_DIR"

echo "✅ Upload complete."

# 5. Remote Finalization
echo "🔄 Finalizing on server (Install deps & Restart)..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR && \
    source ~/.bashrc; \
    if ! command -v pnpm &> /dev/null; then npm install -g pnpm; fi && \
    echo '📦 Installing/Pruning production dependencies...' && \
    pnpm install --prod --frozen-lockfile && \
    echo '🔫 Killing old process on port 3000...' && \
    npx kill-port 3000 || true && \
    echo '▶️ Restarting PM2...' && \
    if pm2 list | grep -q 'ai-chatbot'; then pm2 delete 'ai-chatbot'; fi && \
    # Ensure .env exists!
    if [ -f .env ]; then
      auth_secret=\$(grep AUTH_SECRET .env | cut -d '=' -f2)
    fi && \
    pm2 start npm --name 'ai-chatbot' -- start"

echo "🎉 Deployment successfully completed!"
