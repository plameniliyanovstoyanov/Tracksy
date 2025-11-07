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

# Source .xcode.env if it exists to get NODE_BINARY
if [ -f ".xcode.env" ]; then
    echo "📄 Sourcing .xcode.env for Node.js configuration..."
    set +e  # Temporarily disable exit on error
    source .xcode.env
    set -e  # Re-enable exit on error
    echo "✅ NODE_BINARY: ${NODE_BINARY:-not set}"
fi

# Node.js dependencies should be installed in ci_post_clone.sh
# But check if they exist, if not try to install
echo "🔍 Checking Node.js dependencies..."
if [ ! -d "../node_modules" ] && [ -f "../package.json" ]; then
    echo "⚠️ node_modules not found, trying to install..."
    cd "${CI_WORKSPACE}"
    
    # Try to find node
    NODE_CMD=""
    if [ -n "${NODE_BINARY}" ] && [ -f "${NODE_BINARY}" ]; then
        NODE_CMD="${NODE_BINARY}"
        echo "✅ Using NODE_BINARY from .xcode.env: ${NODE_CMD}"
    elif command -v node &> /dev/null; then
        NODE_CMD=$(command -v node)
        echo "✅ Found node in PATH: ${NODE_CMD}"
    else
        echo "⚠️ node not found!"
        echo "📂 PATH: ${PATH}"
        echo "⚠️ This might cause issues with Expo pods that require Node.js"
    fi
    
    # Try npm install if node is available
    if [ -n "${NODE_CMD}" ]; then
        if command -v npm &> /dev/null; then
            echo "✅ npm found: $(which npm)"
            echo "✅ npm version: $(npm --version)"
            echo "🔨 Running npm install..."
            npm install || echo "⚠️ npm install failed, continuing anyway..."
        else
            echo "⚠️ npm not found, but node exists - Expo pods might still work"
        fi
    fi
    
    cd "${CI_WORKSPACE}/ios"
else
    echo "✅ node_modules found or package.json not present"
fi

# Verify node is available (critical for Expo Podfile)
if [ -n "${NODE_BINARY}" ] && [ -f "${NODE_BINARY}" ]; then
    export NODE_BINARY="${NODE_BINARY}"
    echo "✅ Exporting NODE_BINARY: ${NODE_BINARY}"
elif command -v node &> /dev/null; then
    export NODE_BINARY=$(command -v node)
    echo "✅ Exporting NODE_BINARY from PATH: ${NODE_BINARY}"
else
    echo "⚠️ WARNING: node not found - Expo Podfile might fail!"
    echo "📂 Searching for node in common locations..."
    find /usr/local /opt /usr -name "node" -type f 2>/dev/null | head -5 || echo "No node found"
fi

echo "📦 Installing CocoaPods dependencies..."

# Check if CocoaPods is available
echo "🔍 Checking CocoaPods..."
if ! command -v pod &> /dev/null; then
    echo "⚠️ CocoaPods not found, installing..."
    if command -v gem &> /dev/null; then
        gem install cocoapods --no-document || {
            echo "❌ Failed to install CocoaPods!"
            echo "Trying with sudo..."
            sudo gem install cocoapods --no-document || {
                echo "❌ Failed to install CocoaPods even with sudo"
                exit 1
            }
        }
    else
        echo "❌ gem not found, cannot install CocoaPods!"
        exit 1
    fi
else
    echo "✅ CocoaPods found: $(which pod)"
    echo "✅ CocoaPods version: $(pod --version)"
fi

# Test that node can execute the commands Podfile needs
echo "🧪 Testing Node.js (required for Expo Podfile)..."
if [ -n "${NODE_BINARY}" ] && [ -f "${NODE_BINARY}" ]; then
    if ! "${NODE_BINARY}" --version &>/dev/null; then
        echo "❌ NODE_BINARY exists but cannot execute: ${NODE_BINARY}"
        exit 1
    fi
    echo "✅ Node.js is executable: $("${NODE_BINARY}" --version)"
elif command -v node &> /dev/null; then
    echo "✅ Node.js is available: $(node --version)"
else
    echo "❌ Node.js is required for Expo Podfile but not found!"
    echo "Podfile needs node to resolve: require.resolve('expo/package.json')"
    exit 1
fi

echo "🔨 Running pod install..."
# Run pod install with error handling
# Set NODE_BINARY in environment so Podfile can use it
export NODE_BINARY="${NODE_BINARY:-$(command -v node)}"

if ! pod install --repo-update; then
    echo "⚠️ pod install failed with --repo-update, trying without..."
    if ! pod install; then
        echo "❌ pod install failed completely!"
        echo "📂 Current directory contents:"
        ls -la
        echo "📂 Checking Podfile:"
        head -20 Podfile
        echo ""
        echo "🔍 Testing Node.js commands from Podfile..."
        if [ -n "${NODE_BINARY}" ]; then
            echo "Testing: node --print \"require.resolve('expo/package.json')\""
            "${NODE_BINARY}" --print "require.resolve('expo/package.json')" || echo "❌ Node.js command failed!"
        fi
        exit 1
    fi
fi

# Verify that xcconfig files were created
echo "🔍 Verifying xcconfig files..."
if [ ! -f "Pods/Target Support Files/Pods-Tracksy/Pods-Tracksy.release.xcconfig" ]; then
    echo "⚠️ Pods-Tracksy.release.xcconfig not found, checking what exists..."
    echo "📂 Listing Pods directory:"
    if [ -d "Pods" ]; then
        find Pods -name "*.xcconfig" -type f | head -10 || echo "No xcconfig files found"
        ls -la Pods/Target\ Support\ Files/ 2>/dev/null || echo "Target Support Files directory not found"
    else
        echo "❌ Pods directory does not exist!"
        exit 1
    fi
    exit 1
fi

echo "✅ CocoaPods installation completed successfully!"
echo "✅ xcconfig files verified"
