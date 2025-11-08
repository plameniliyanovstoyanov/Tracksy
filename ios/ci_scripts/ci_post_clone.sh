#!/bin/zsh

set -euxo pipefail

echo "✅ ci_post_clone.sh: start"

# Диагностика (виждат се в логовете)
xcodebuild -version || true
ruby -v || true
which pod && pod --version || true

# Проверка за Node.js (нужен за Expo Podfile autolinking)
if ! command -v node &> /dev/null; then
  echo "⚠️ Node.js not found in PATH, but Podfile requires it for autolinking"
  echo "ℹ️ Xcode Cloud should have Node.js pre-installed, checking common locations..."
  
  # Проверка за Node.js в общите места
  if [ -f "/usr/local/bin/node" ]; then
    export PATH="/usr/local/bin:$PATH"
    echo "✅ Found Node.js in /usr/local/bin"
  elif [ -f "/opt/homebrew/bin/node" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
    echo "✅ Found Node.js in /opt/homebrew/bin"
  else
    echo "⚠️ Node.js not found - pod install might fail"
    echo "ℹ️ This is expected for iOS Archive - JS bundle is created on device"
  fi
fi

# Проверка дали Node.js работи (ако е наличен)
if command -v node &> /dev/null; then
  echo "✅ Node.js version: $(node --version)"
  echo "✅ Node.js path: $(which node)"
else
  echo "⚠️ Node.js not available - continuing anyway"
fi

# Единственото нужно за iOS Archive: Pods
cd "$CI_WORKSPACE/ios"

pod repo update
pod install

echo "✅ ci_post_clone.sh: done"
