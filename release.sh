#!/bin/bash
set -e

# Parse flags
AUTO_PUBLISH=false
for arg in "$@"; do
    case "$arg" in
        --auto) AUTO_PUBLISH=true ;;
    esac
done

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_CONF="$SCRIPT_DIR/src-tauri/tauri.conf.json"
PACKAGE_JSON="$SCRIPT_DIR/package.json"
CARGO_TOML="$SCRIPT_DIR/src-tauri/Cargo.toml"
INDEX_TS="$SCRIPT_DIR/src/index.ts"

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed.${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Read current version from tauri config as source of truth
CURRENT_VERSION=$(jq -r '.version' "$TAURI_CONF")

# Calculate next patch version
IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
NEXT_PATCH=$((patch + 1))
NEXT_VERSION="$major.$minor.$NEXT_PATCH"

echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"
echo -e "Next version:    ${GREEN}$NEXT_VERSION${NC}"
echo ""

# Prompt for version bump
read -p "Bump version to $NEXT_VERSION before building? (y/N) " -n 1 -r
echo ""
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    VERSION_TO_BUILD="$NEXT_VERSION"
    echo -e "${CYAN}Updating version numbers to $NEXT_VERSION...${NC}"
    
    # 1. Update tauri.conf.json
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEXT_VERSION\"/" "$TAURI_CONF"
    echo "  ✓ Updated tauri.conf.json"
    
    # 2. Update package.json
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEXT_VERSION\"/" "$PACKAGE_JSON"
    echo "  ✓ Updated package.json"
    
    # 3. Update Cargo.toml
    sed -i '' "s/version = \"$CURRENT_VERSION\"/version = \"$NEXT_VERSION\"/" "$CARGO_TOML"
    echo "  ✓ Updated Cargo.toml"
    
    # 4. Update src/index.ts
    sed -i '' "s/.version('$CURRENT_VERSION')/.version('$NEXT_VERSION')/" "$INDEX_TS"
    echo "  ✓ Updated src/index.ts"
    
else
    VERSION_TO_BUILD="$CURRENT_VERSION"
    echo -e "${YELLOW}Keeping current version $CURRENT_VERSION${NC}"
fi

echo ""
echo -e "${CYAN}Building release v$VERSION_TO_BUILD...${NC}"
if ! bun run tauri build; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Build complete!${NC}"

# Find DMG - handle potential spaces in spaces in filename (Tauri 2 uses productName)
# Pattern match to be safe
DMG_DIR="$SCRIPT_DIR/src-tauri/target/release/bundle/dmg"
DMG_PATH=$(find "$DMG_DIR" -name "*_${VERSION_TO_BUILD}_*.dmg" | head -1)

if [[ -z "$DMG_PATH" || ! -f "$DMG_PATH" ]]; then
    echo -e "${RED}Error: DMG not found for version $VERSION_TO_BUILD in $DMG_DIR${NC}"
    exit 1
fi

# Calculate SHA256
SHA256=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')

# Update Homebrew cask file
CASK_FILE="$SCRIPT_DIR/../homebrew-tap/Casks/photo-bridge.rb"
if [[ -f "$CASK_FILE" ]]; then
    echo -e "${CYAN}Updating Homebrew cask...${NC}"
    # Update version
    sed -i '' "s/version \".*\"/version \"$VERSION_TO_BUILD\"/" "$CASK_FILE"
    # Update sha256
    sed -i '' "s/sha256 \".*\"/sha256 \"$SHA256\"/" "$CASK_FILE"
    echo -e "${GREEN}Cask file updated!${NC}"
else
    echo -e "${RED}Warning: Cask file not found at $CASK_FILE${NC}"
fi

# Cleanup filesystem (silently)
find "$SCRIPT_DIR" -name "*.bun-build" -type f -delete

# Output results
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}SUCCESS! Release Ready${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Version:  ${CYAN}$VERSION_TO_BUILD${NC}"
echo -e "DMG Path: ${CYAN}$DMG_PATH${NC}"
echo -e "SHA256:   ${CYAN}$SHA256${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
if $AUTO_PUBLISH; then
    echo ""
    echo -e "${CYAN}Publishing release...${NC}"

    echo -e "${CYAN}Step 1: Committing changes...${NC}"
    git -C "$SCRIPT_DIR" add -A && git -C "$SCRIPT_DIR" commit -m "Release v$VERSION_TO_BUILD"
    echo -e "${GREEN}  ✓ Changes committed${NC}"

    echo -e "${CYAN}Step 2: Creating tag and pushing...${NC}"
    git -C "$SCRIPT_DIR" tag "v$VERSION_TO_BUILD"
    git -C "$SCRIPT_DIR" push origin master --tags
    echo -e "${GREEN}  ✓ Tag v$VERSION_TO_BUILD pushed${NC}"

    echo -e "${CYAN}Step 3: Creating GitHub release...${NC}"
    gh release create "v$VERSION_TO_BUILD" "$DMG_PATH" --title "v$VERSION_TO_BUILD" --generate-notes
    echo -e "${GREEN}  ✓ GitHub release created${NC}"

    echo ""
    echo -e "${GREEN}🎉 Release v$VERSION_TO_BUILD published!${NC}"
else
    echo ""
    echo -e "${CYAN}To publish this release:${NC}"
    echo ""
    echo "  1. Commit changes:"
    echo "     git add -A && git commit -m \"Release v$VERSION_TO_BUILD\""
    echo ""
    echo "  2. Create tag:"
    echo "     git tag v$VERSION_TO_BUILD"
    echo "     git push origin master --tags"
    echo ""
    echo "  3. Create GitHub release:"
    echo "     gh release create v$VERSION_TO_BUILD \"$DMG_PATH\" --title \"v$VERSION_TO_BUILD\" --generate-notes"
    echo ""
    echo -e "${YELLOW}Tip: Run with --auto to publish automatically.${NC}"
    echo ""
fi
