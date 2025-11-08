#!/bin/zsh

set -e

echo "✅ ci_post_clone.sh: start"

# Диагностика
xcodebuild -version || true
ruby -v || true
which pod && pod --version || true

# Намиране на ios директорията (скриптът е в ios/ci_scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📂 iOS directory: $IOS_DIR"

# Проверка
if [ ! -f "$IOS_DIR/Podfile" ]; then
  echo "❌ Podfile not found in: $IOS_DIR"
  exit 1
fi

# CocoaPods installation
cd "$IOS_DIR"

echo "📦 Running pod repo update..."
pod repo update || true

echo "📦 Running pod install..."
pod install

echo "✅ ci_post_clone.sh: done"
