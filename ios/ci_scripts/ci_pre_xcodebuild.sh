#!/bin/sh

# CI Pre-Xcodebuild Script for Xcode Cloud
# This script runs before Xcode build to install dependencies

# Exit on error for critical steps
set -e

echo "🔧 Running pre-build script for Xcode Cloud..."
echo "📂 Current directory: $(pwd)"
echo "📂 CI_WORKSPACE: ${CI_WORKSPACE}"

# Navigate to ios directory
cd "${CI_WORKSPACE}/ios"

echo "📂 Changed to: $(pwd)"

# Check if Podfile exists
if [ ! -f "Podfile" ]; then
    echo "❌ Podfile not found in $(pwd)!"
    ls -la
    exit 1
fi

echo "✅ Podfile found"

# Node.js dependencies should be installed in ci_post_clone.sh
# But check if they exist, if not try to install
if [ ! -d "../node_modules" ] && [ -f "../package.json" ]; then
    echo "⚠️ node_modules not found, trying to install..."
    cd "${CI_WORKSPACE}"
    
    if command -v npm &> /dev/null; then
        npm install || echo "⚠️ npm install failed, continuing anyway..."
    else
        echo "⚠️ npm not found, skipping Node.js dependencies"
    fi
    
    cd "${CI_WORKSPACE}/ios"
fi

echo "📦 Installing CocoaPods dependencies..."

# Check if CocoaPods is available
if ! command -v pod &> /dev/null; then
    echo "⚠️ CocoaPods not found, installing..."
    gem install cocoapods --no-document
fi

echo "🔨 Running pod install..."
pod install --repo-update

# Verify that xcconfig files were created
if [ ! -f "Pods/Target Support Files/Pods-Tracksy/Pods-Tracksy.release.xcconfig" ]; then
    echo "❌ Pods-Tracksy.release.xcconfig not found after pod install!"
    echo "📂 Listing Pods directory:"
    ls -la Pods/Target\ Support\ Files/Pods-Tracksy/ 2>/dev/null || echo "Pods directory not found"
    exit 1
fi

echo "✅ CocoaPods installation completed successfully!"
echo "✅ xcconfig files verified"
