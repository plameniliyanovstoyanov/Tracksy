#!/bin/sh

# CI Post-Clone Script for Xcode Cloud
# This script runs after cloning the repository to install dependencies

# Don't exit on error - continue even if npm install fails
set +e

echo "🔧 Running post-clone script for Xcode Cloud..."
echo "📂 CI_WORKSPACE: ${CI_WORKSPACE}"
echo "📂 Current directory: $(pwd)"

# Navigate to project root
if [ -n "${CI_WORKSPACE}" ]; then
    cd "${CI_WORKSPACE}"
    echo "📂 Changed to: $(pwd)"
else
    echo "⚠️ CI_WORKSPACE not set, using current directory"
fi

echo "📦 Installing Node.js dependencies..."

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "⚠️ npm not found, trying to find node..."
    if command -v node &> /dev/null; then
        echo "✅ node found, but npm not in PATH"
        echo "📂 PATH: ${PATH}"
    else
        echo "❌ Neither npm nor node found!"
        echo "⚠️ Continuing anyway - pods might need node_modules"
    fi
else
    echo "✅ npm found: $(which npm)"
    echo "✅ npm version: $(npm --version)"
    
    # Install Node.js dependencies
    echo "🔨 Running npm install..."
    npm install || {
        echo "⚠️ npm install failed, but continuing..."
    }
fi

echo "✅ Post-clone script completed!"

# Always exit successfully - npm install is optional
exit 0

