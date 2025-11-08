#!/bin/bash

set -euxo pipefail

echo "✅ post_clone start"

xcodebuild -version || true
ruby -v || true
which pod && pod --version || true

# Единственото нужно: Pods

cd ios

pod repo update
pod install

cd ..

echo "✅ post_clone done"

