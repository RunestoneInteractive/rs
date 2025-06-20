#!/bin/bash

# Usage: ./create_release.sh v1.2.3
# Make sure gh CLI is installed and authenticated

set -e

# Accept tag as input
TAG="$1"

# check that the current working directory ends with projects/interactives 
if [[ ! "$(pwd)" =~ /projects/interactives$ ]]; then
  echo "This script must be run from the 'projects/interactives' directory."
  exit 1
fi


if [ -z "$TAG" ]; then
  echo "Usage: $0 <tag>"
  exit 1
fi

# Optional: extract version part if needed
VERSION="${TAG#v}"

# Construct filenames
TGZ_FILE="../../bases/rsptx/interactives/dist-${VERSION}.tgz"
WHL_FILE="./dist/runestone-${VERSION}-py3-none-any.whl"

# Check files exist
if [[ ! -f "$TGZ_FILE" || ! -f "$WHL_FILE" ]]; then
  echo "Missing one or both files: $TGZ_FILE, $WHL_FILE"
  exit 1
fi

# Create release (change body or title as needed)
gh release create "$TAG" \
  "$TGZ_FILE" "$WHL_FILE" \
  --title "Release $TAG" \
  --notes "Automated release of version $VERSION"

echo "Release $TAG created successfully."