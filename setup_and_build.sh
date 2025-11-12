#!/bin/bash

# -----------------------------------------------
# Crypto Dashboard - Setup & Build Script
# -----------------------------------------------

echo "🚀 Starting setup and build process..."

# 1️⃣ Activate Python virtual environment
if [ ! -d ".venv_local" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv_local
fi
echo "Activating Python virtual environment..."
source .venv_local/bin/activate

# 2️⃣ Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements-vercel.txt

# 3️⃣ Install Node dependencies
echo "Installing Node.js dependencies..."
npm install
npm install tailwindcss postcss autoprefixer
npm install chart.js react-chartjs-2 chartjs-chart-financial chartjs-adapter-date-fns

# 4️⃣ Fix import paths for Vercel (optional)
echo "Fixing import paths..."
npm run prebuild

# 5️⃣ Clean previous builds
echo "Cleaning previous builds..."
rm -rf .next

# 6️⃣ Build Next.js for production
echo "Building Next.js project..."
npm run build

# 7️⃣ Verify build success
if [ $? -eq 0 ]; then
    echo "🎉 Build successful! Project ready to push to GitHub & deploy on Vercel."
else
    echo "❌ Build failed. Check errors above and fix before deploying."
    exit 1
fi

# 8️⃣ Optional: test local server
echo "Starting local Next.js server for verification..."
npm start &
echo "✅ Local server started on http://localhost:3000"
echo "Use Ctrl+C to stop local server after testing."

