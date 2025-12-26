#!/bin/bash

echo "🚀 Setup Project Absensi RFID Dimulai..."

# ===============================
# System Dependencies
# ===============================
echo "📦 Install system dependencies..."
sudo apt update
sudo apt install -y mysql-client-core-8.0 mysql-server build-essential curl

# ===============================
# Node Project Init
# ===============================
echo "📁 Inisialisasi Node.js project..."
npm init -y

# ===============================
# Core Dependencies
# ===============================
echo "📦 Install core npm packages..."
npm install express mysql mysql2 dotenv body-parser express-session multer ejs mysqldump cors bcryptjs

# ===============================
# Development Dependencies
# ===============================
echo "🛠️ Install dev dependencies..."
npm install --save-dev nodemon

# ===============================
# PM2 (Production Process Manager)
# ===============================
echo "⚙️ Install PM2..."
npm install -g pm2

echo "✅ Setup selesai!"
echo "📌 Jangan lupa:"
echo "   - Buat file .env"
echo "   - Pastikan database & tabel sudah tersedia"
