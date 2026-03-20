#!/usr/bin/env zsh

OUTPUT="photo-bridge-code.zip"

zip -r "$OUTPUT" \
  src \
  src-ui \
  src-tauri/src \
  src-tauri/Cargo.toml \
  src-tauri/tauri.conf.json \
  package.json \
  TASKS.md \
  google-photos-metadata-fix-and-reupload-strategy.md \
  -x "*/node_modules/*" \
  -x "*/dist/*" \
  -x "*/.git/*"

echo "Created $OUTPUT"
