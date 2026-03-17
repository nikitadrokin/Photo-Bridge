# iPhone to Pixel - Feature Improvements

## 🎨 UI/UX Enhancements

- [ ] **1. Progress Indicator for Conversions** - Add progress bar showing "3/10 files processed"
- [ ] **2. Thumbnail Previews** - Show thumbnails in PathList component
- [ ] **3. Recent Files/Folders History** - Quick-access to frequently used directories
- [ ] **4. Dark Mode Toggle** - Add visible theme switcher in sidebar/footer
- [ ] **5. Drag-and-Drop Visual Feedback** - Show file count and accepted/rejected files during drag
- [ ] **6. Conversion Presets** - Save custom output settings (Archive quality, Quick share)

## ⚙️ Feature Additions

- [ ] **7. Output Directory Selection** - Choose custom output location instead of auto `_Remuxed`
- [ ] **8. File Renaming Options** - Rename based on capture date (e.g., `2024-01-15_IMG_0001.mp4`)
- [ ] **9. HEIC→JPG Conversion Option** - Optional conversion for broader compatibility
- [ ] **10. Batch Metadata Viewer** - Display EXIF metadata before conversion
- [ ] **11. Conversion Statistics/Summary** - Show file sizes, space saved, processing time
- [ ] **12. Undo/Rollback Support** - Track converted files and allow reverting
- [ ] **13. Live Preview for Video** - Quick thumbnail preview before processing

## 🔧 Backend/Logic Improvements

- [ ] **14. Parallel Processing** - Process multiple files simultaneously (configurable concurrency)
- [ ] **15. Resume/Retry Failed Conversions** - Track failed files with "Retry Failed" button
- [ ] **16. Skip Already-Converted Detection** - Use file hashes instead of filename matching
- [ ] **17. Video Compression Option** - Optional re-encoding with quality slider
- [ ] **18. WebP/AVIF Support** - Add modern image format conversions
- [ ] **19. Subtitle Preservation** - Preserve embedded subtitles/captions during remuxing
- [ ] **20. Live Photo Handling** - Detect and process iPhone Live Photos (HEIC + MOV pairs)

## 🔐 Quality of Life

- [ ] **21. Settings/Preferences Panel** - Centralized settings for default behaviors
- [ ] **22. Keyboard Shortcuts** - Add ⌘O for open, ⌘R for run conversion
- [ ] **23. Notification Center Integration** - macOS notification when batch completes
- [ ] **24. Menu Bar Quick Actions** - Menu bar icon for quick file dropping
- [ ] **25. Error Logging/Export** - Save detailed logs to file for troubleshooting

## 📦 Deployment/Distribution

- [ ] **26. Auto-Update Mechanism** - Integrate Tauri's built-in auto-updater
- [ ] **27. Dependency Checker UI** - Show status of ffmpeg/exiftool in sidebar with install instructions

## 🎭 User Personas & Modes

- [ ] **28. UI Classification System** - Distinct interfaces for different user types:
  - **Easy User**: Simplified "Transfer to Done" single-button interface.
  - **Power User**: Standard full-featured UI with granular controls.
  - **Developer**: Advanced mode with direct terminal access and deeper system visibility.

- [ ] **29. Developer Mode: Shell Emulation** - Replicate a "Pixel Shell" navigation experience:
  - **Action-to-Terminal Mapping**: Every UI action (e.g., navigating SD card, DCIM) automatically opens/updates an interactive terminal window.
  - **Real-time Interaction**: Allow users to interact with the shell and file system directly during the flow.
  - **Command Transparency**: Show the exact underlying commands being executed in real-time.
