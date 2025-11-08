#!/bin/zsh

set -e

echo "✅ ci_post_clone.sh: start"

# Диагностика
xcodebuild -version || true
ruby -v || true
which pod && pod --version || true

# Node.js е нужен за Expo Podfile autolinking
# Опитваме се да намерим или инсталираме Node.js
if ! command -v node &> /dev/null; then
  echo "⚠️ Node.js not found in PATH, installing..."
  
  # Проверка за Node.js в общите места
  if [ -f "/usr/local/bin/node" ]; then
    export PATH="/usr/local/bin:$PATH"
    echo "✅ Found Node.js in /usr/local/bin"
  elif [ -f "/opt/homebrew/bin/node" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
    echo "✅ Found Node.js in /opt/homebrew/bin"
  else
    # Инсталиране на Node.js чрез Homebrew (ако е наличен)
    if command -v brew &> /dev/null; then
      echo "📦 Installing Node.js via Homebrew..."
      brew install node || {
        echo "⚠️ Homebrew install failed, trying nvm..."
        # Опитваме се с nvm
        export NVM_DIR="$HOME/.nvm"
        if [ ! -s "$NVM_DIR/nvm.sh" ]; then
          curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        fi
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install 20
        nvm use 20
      }
    else
      # Инсталиране на nvm като fallback
      echo "📦 Installing Node.js via nvm..."
      export NVM_DIR="$HOME/.nvm"
      if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      fi
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
      nvm install 20
      nvm use 20
    fi
  fi
fi

# Проверка дали Node.js работи
if command -v node &> /dev/null; then
  echo "✅ Node.js version: $(node --version)"
  echo "✅ Node.js path: $(which node)"
  export NODE_BINARY="$(which node)"
else
  echo "❌ Node.js still not available after installation attempt"
  exit 1
fi

# Намиране на ios директорията
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
