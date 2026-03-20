# PhotoBridge

A lightweight macOS utility to convert iOS media files (HEIC, MOV, HEVC) into formats compatible with Google Pixel 1 (and other devices), preserving original metadata and quality.

## Features

- **Photos**: Converts HEIC to JPG (or copies if compatible) preserving EXIF data.
- **Videos**: Remuxes MOV/HEVC to MP4 container without re-encoding video streams (preserves HDR), converts audio to AAC.
- **Metadata**: Fixes creation dates to match original capture time.
- **In-Place**: Converts individual files in the same folder.
- **Batch**: Processes entire folders into a `_Remuxed` subdirectory.

## Prerequisites

You need the following tools installed on your system for the converter to work (even the compiled app relies on these):

```bash
brew install ffmpeg exiftool
```

## Installation

### From Source

To build the app manually (e.g., to create a `.dmg` or `.app` file):

1.  **Install Build Tools**:
    Ensure you have [Bun](https://bun.sh) and [Rust](https://www.rust-lang.org/tools/install) installed.
    ```bash
    brew install bun rust
    ```

2.  **Clone & Install**:
    ```bash
    git clone https://github.com/nikitadrokin/photo-bridge.git
    cd photo-bridge
    bun install
    ```

3.  **Build**:
    This command compiles the internal CLI tool and bundles it into a native macOS application.
    ```bash
    bun run tauri build
    ```
    
    The output (e.g., `.dmg`, `.app`) will be located in:
    `src-tauri/target/release/bundle/dmg/`

### Via Homebrew

You can install the app easily using Homebrew:

```bash
brew install nikitadrokin/tap/photo-bridge
```

#### "App is damaged" Error
If you see a message saying *"PhotoBridge" is damaged and can't be opened*, this is due to macOS security requirements for non-App Store apps. To fix it, run:

```bash
xattr -cr '/Applications/PhotoBridge.app'
```


## Development

To run the app in development mode with hot-reloading:

```bash
bun run tauri dev
```

## Spatial Audio Pipeline

Spatial-audio-aware migration guidance, limitations, and copyable ffmpeg/ffprobe commands are documented in `docs/README.spatial.md`.

For Pixel upload automation, use:

```bash
itp push-to-pixel /path/to/output_pixel_compat.mp4
```

