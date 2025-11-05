#!/bin/sh

# CI Post-Clone Script for Xcode Cloud
# This script runs after cloning the repository to install dependencies

set -e

echo "🔧 Running post-clone script for Xcode Cloud..."

# Navigate to project root
cd "${CI_WORKSPACE}"

echo "📦 Installing Node.js dependencies..."

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found!"
    exit 1
fi

# Install Node.js dependencies
echo "🔨 Running npm install..."
npm install

echo "✅ Node.js dependencies installed successfully!"

