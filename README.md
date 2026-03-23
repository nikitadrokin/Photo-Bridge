# PhotoBridge

Convert iOS photos and videos (HEIC, MOV, HEVC) into formats your Pixel can handle — without re-encoding or losing data.

Requires `ffmpeg` and `exiftool` (`brew install ffmpeg exiftool`).

## Install

```bash
brew install nikitadrokin/tap/photo-bridge
xattr -cr '/Applications/PhotoBridge.app'
```

> Since I don't have a paid Apple Developer account, macOS will flag the app as unsafe. The `xattr` line clears that macOS "quarantine" flag so it'll be safe to open.

## Contributing

Requires [Bun](https://bun.sh) and [Rust](https://www.rust-lang.org/tools/install).

```bash
git clone https://github.com/nikitadrokin/photo-bridge.git
cd photo-bridge
bun install
bun run tauri dev   # dev mode with hot-reload
bun run tauri build # outputs .dmg/.app to src-tauri/target/release/bundle/
```
