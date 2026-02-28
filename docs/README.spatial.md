# Spatial Audio Migration Notes (iPhone → Pixel 1 → Google Photos)

This project includes a spatial-audio-aware pipeline for iPhone 15 Pro / 17 Pro sources and Pixel 1 uploads.

## Key behaviors

- `inspectFile()` runs `ffprobe` and persists per-file probe JSON for auditability.
- `decidePipeline()` chooses one of:
  - `remux-atmos` for E-AC-3 + Atmos/JOC signaling.
  - `apac-detected` for Apple APAC/ASAF signaling.
  - `transcode-multichannel` for non-Atmos multichannel streams.
  - `stereo-fallback` for broadly compatible outputs.
- Originals are archived and never deleted.
- Every processed output has a `manifest.json` with codec/channel/pipeline/hash details.

## Licensing and codec limitations

- Dolby Atmos authoring requires Dolby-licensed encoders and metadata tooling.
- APAC / ASAF is proprietary Apple technology.
- This repository does not reverse engineer or claim APAC-to-Atmos conversion.
- Stock ffmpeg cannot reliably decode/encode APAC for object-based Atmos regeneration.

## Pixel upload strategy

Preferred:
1. Push converted files to Pixel `/DCIM/Camera`.
2. Trigger media scanner broadcast.
3. Let Google Photos upload from the Pixel device itself.

Metadata spoofing can be attempted but is not reliable for unlimited upload eligibility.

## Copyable CLI examples

Inspect:

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mov > input.probe.json
```

Stereo fallback:

```bash
ffmpeg -y -i input.mov -map_metadata 0 \
  -map 0:v:0 -map 0:a:0 \
  -c:v libx264 -preset slow -crf 18 -profile:v high \
  -c:a aac -b:a 256k -ac 2 \
  -movflags +faststart \
  output_pixel_compat.mp4
```

Remux Atmos:

```bash
ffmpeg -y -i input.mov -map 0:v:0 -map 0:a:0 -c:v copy -c:a copy -movflags +faststart output_atmos.mp4
```

Force metadata:

```bash
ffmpeg -y -i input.mov -map 0 -c copy -metadata make="Google" -metadata model="Pixel 1" output_spoofed.mp4
```

ADB push helper behavior:

```bash
adb push output_pixel_compat.mp4 /sdcard/DCIM/Camera/
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/DCIM/Camera/output_pixel_compat.mp4
```
