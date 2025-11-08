#!/bin/zsh

set -euxo pipefail

echo "✅ ci_post_clone.sh: start"

# Диагностика (виждат се в логовете)
xcodebuild -version || true
ruby -v || true
which pod && pod --version || true

# Единственото нужно за iOS Archive: Pods
cd "$CI_WORKSPACE/ios"

pod repo update
pod install

echo "✅ ci_post_clone.sh: done"
