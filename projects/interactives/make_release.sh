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

# Upload the exact tarball that `build.py --publish` installed on the CDN (it moves
# it to jsdist/), so GitHub and runestone.academy/cdn serve byte-identical files.
# Don't use bases/rsptx/interactives/dist-<ver>.tgz: dist2xml.py rewrites it on
# every build, and the new bytes (and hash) differ even when the contents match.
TGZ_FILE="../../bases/rsptx/interactives/jsdist/dist-${VERSION}.tgz"
TGZ_NAME="$(basename "$TGZ_FILE")"

if [[ ! -f "$TGZ_FILE" ]]; then
  echo "Missing $TGZ_FILE -- run ./build.py --publish first."
  exit 1
fi

SHA256=$(shasum -a 256 "$TGZ_FILE" | awk '{print $1}')
echo "$TGZ_NAME sha256: $SHA256"

# check for a GITHUB_TOKEN environment variable, if it exists temporarily unset it
if [[ -n "$GITHUB_TOKEN" ]]; then
  OLD_GITHUB_TOKEN="$GITHUB_TOKEN"
  unset GITHUB_TOKEN
fi
# Create release (change body or title as needed)
NOTES="Automated release of version $VERSION

SHA-256 of \`$TGZ_NAME\`:

\`\`\`
$SHA256
\`\`\`

Verify a download with \`shasum -a 256 $TGZ_NAME\`."

# Release immutability is on for this repo: once a release is published, its
# tag and assets can never be changed.  So create a draft, check the uploaded
# asset while it can still be fixed, and only then publish.
gh release create "$TAG" \
  "$TGZ_FILE" \
  --draft \
  --title "Release $TAG" \
  --notes "$NOTES"

# Confirm GitHub received the same bytes we hashed.  The digest can lag the
# upload by a moment, so retry briefly before giving up.
REMOTE_DIGEST=""
for _ in 1 2 3 4 5; do
  REMOTE_DIGEST=$(gh release view "$TAG" --json assets \
    -q ".assets[] | select(.name==\"$TGZ_NAME\") | .digest")
  [[ -n "$REMOTE_DIGEST" ]] && break
  sleep 2
done
if [[ "$REMOTE_DIGEST" != "sha256:$SHA256" ]]; then
  echo "ERROR: GitHub digest for $TGZ_NAME is '$REMOTE_DIGEST', expected sha256:$SHA256"
  echo "Deleting the draft release $TAG; nothing was published."
  gh release delete "$TAG" --yes
  exit 1
fi

# Publish.  This creates the tag and locks the release.
gh release edit "$TAG" --draft=false

if gh release verify "$TAG"; then
  echo "Release $TAG published and immutable; asset sha256:$SHA256"
else
  echo "WARNING: Release $TAG is published but is not immutable."
  echo "Turn on Settings > General > Releases > 'Enable release immutability'."
fi

# Restore GITHUB_TOKEN if it was unset
if [[ -n "$OLD_GITHUB_TOKEN" ]]; then
  export GITHUB_TOKEN="$OLD_GITHUB_TOKEN"
  unset OLD_GITHUB_TOKEN
fi

