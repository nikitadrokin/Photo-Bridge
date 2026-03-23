# PhotoBridge

Convert iOS photos and videos (HEIC, MOV, HEVC) into formats your Pixel can handle — without re-encoding or losing data.

Requires `ffmpeg` and `exiftool` (`brew install ffmpeg exiftool`).

## Install

```bash
brew install nikitadrokin/tap/photo-bridge
xattr -cr '/Applications/PhotoBridge.app'
```

> The `xattr` line clears the macOS quarantine flag. You'll get an "app is damaged" error without it.

## Contributing

Requires [Bun](https://bun.sh) and [Rust](https://www.rust-lang.org/tools/install).

```bash
git clone https://github.com/nikitadrokin/photo-bridge.git
cd photo-bridge
bun install
bun run tauri dev   # dev mode with hot-reload
bun run tauri build # outputs .dmg/.app to src-tauri/target/release/bundle/
```
