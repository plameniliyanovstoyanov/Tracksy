#!/bin/sh

set -euo pipefail

echo "✅ ci_post_clone.sh started"

# 1) Node (ползвай nvm)

export NODE_VERSION="20"

if [ -z "${NVM_DIR:-}" ]; then
  export NVM_DIR="$HOME/.nvm"
fi

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

. "$NVM_DIR/nvm.sh"

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

node -v
npm -v

# 2) JS dependencies

npm ci

# 3) Ruby/Bundler/Pods

gem install bundler -N

bundle config set path 'vendor/bundle'

bundle install --quiet

cd ios

# Ако проектът ти ползва use_frameworks! или свеж RN/Pods – пази --repo-update

bundle exec pod install --repo-update

cd ..

# 4) .env за билд тайм променливи (ако app.config.js ги чете)

cat > .env <<EOF
EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL:-}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}
EXPO_PUBLIC_MAPBOX_TOKEN=${EXPO_PUBLIC_MAPBOX_TOKEN:-}
MAPBOX_DOWNLOADS_TOKEN=${MAPBOX_DOWNLOADS_TOKEN:-}
EOF

echo "✅ ci_post_clone.sh finished"
