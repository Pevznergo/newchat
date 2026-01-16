#!/bin/bash
set -e

echo "🚀 Starting server provisioning..."

# 1. Update System
echo "🔄 Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl git unzip build-essential

# 2. Install Node.js (Latest LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pnpm pm2

# 3. Install Nginx & Certbot
echo "🌐 Installing Nginx & Certbot..."
apt-get install -y nginx python3-certbot-nginx
systemctl enable nginx
systemctl start nginx

# 4. Setup Directories
echo "📂 Creating project directories..."
mkdir -p /var/www/aporto.tech
mkdir -p /var/www/app.aporto.tech

# Create placeholder for landing page
echo "<h1>Coming Soon - Aporto</h1>" > /var/www/aporto.tech/index.html
chown -R www-data:www-data /var/www/aporto.tech /var/www/app.aporto.tech
chmod -R 755 /var/www

# 5. Add Swap (Low resource safety)
if [ ! -f /swapfile ]; then
    echo "💾 Setting up 4GB Swap..."
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1G count=4
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "✅ Server provisioned successfully!"
