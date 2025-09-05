#!/bin/bash

# Setup script for FoundryVTT Module Template
# Run this after creating a new repository from the template

set -e

echo "🚀 Setting up FoundryVTT Module..."

# Get the repository name (assuming we're in the repo directory)
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")

# Get GitHub repository description
REPO_OWNER=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\)\/.*/\1/')
if [ -n "$REPO_OWNER" ] && [ -n "$REPO_NAME" ]; then
  # Try to get description from GitHub API
  REPO_DESCRIPTION=$(curl -s "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME" | jq -r '.description // empty' 2>/dev/null || echo "")
  if [ -z "$REPO_DESCRIPTION" ]; then
    REPO_DESCRIPTION="A FoundryVTT module"
  fi
else
  REPO_DESCRIPTION="A FoundryVTT module"
fi

# Generate module variables
MODULE_ID="$REPO_NAME"
MODULE_TITLE=$(echo "$MODULE_ID" | sed -e 's/[-_]/ /g' -e 's/\b\(.\)/\u\1/g')
MODULE_LOG_PREFIX=$(echo "$MODULE_TITLE" | grep -oE '\b\w' | tr -d '\n' | tr 'a-z' 'A-Z')
MODULE_CODE=$(echo "$MODULE_ID" | sed 's/[^a-zA-Z0-9]//g' | cut -c1-3 | tr 'a-z' 'A-Z')

echo "📝 Module ID: $MODULE_ID"
echo "📝 Module Title: $MODULE_TITLE"
echo "📝 Module Description: $REPO_DESCRIPTION"
echo "📝 Module Log Prefix: $MODULE_LOG_PREFIX"
echo "📝 Module Code: $MODULE_CODE"

# Replace placeholders in files
echo "🔄 Replacing placeholders..."

# Find and replace in all relevant files
find . -type f \( -name "*.json" -o -name "*.mjs" -o -name "*.ts" -o -name "*.js" \) -not -path "./node_modules/*" -not -path "./.git/*" -print0 | while IFS= read -r -d $'\0' file; do
  if [ -f "$file" ]; then
    sed -i.bak "s#<MODULE_ID>#$MODULE_ID#g" "$file"
    sed -i.bak "s#<MODULE_TITLE>#$MODULE_TITLE#g" "$file"
    sed -i.bak "s#<MODULE_LOG_PREFIX>#$MODULE_LOG_PREFIX#g" "$file"
    sed -i.bak "s#<MODULE_CODE>#$MODULE_CODE#g" "$file"
    sed -i.bak "s#<MODULE_DESCRIPTION>#$REPO_DESCRIPTION#g" "$file"
    # Also handle GitHub template variables
    sed -i.bak "s#\${{MODULE_ID}}#$MODULE_ID#g" "$file"
    sed -i.bak "s#\${{MODULE_TITLE}}#$MODULE_TITLE#g" "$file"
    sed -i.bak "s#\${{MODULE_DESCRIPTION}}#$REPO_DESCRIPTION#g" "$file"
    sed -i.bak "s#\${{REPOSITORY_OWNER}}#geoidesic#g" "$file"
    rm -f "$file.bak"
  fi
done

# Remove this setup script
rm -f setup.sh

echo "✅ Setup complete! Your module is ready to go."
echo "📦 Run 'bun install' to install dependencies"
echo "🔧 Run 'bun run dev' to start development"
