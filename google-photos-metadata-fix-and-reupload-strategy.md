<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I've already started making my own tool, and if you do deep research on it, you'll see what my approach is. My question is: can you research it deeply and provide feedback on how I can further improve the logic to save the datetimes however I can? We can do this by stitching together what works from Google Photos (you mentioned the JSON file), and using that to work on the files and make them seem originally made in their true time. Also, since Labs is selected, either make a tool or a prettier form of showing me an example of how this would be done using the tool I'm developing now.

[https://github.com/nikitadrokin/iphone-to-pixel](https://github.com/nikitadrokin/iphone-to-pixel)

![Metadata DateTime Preservation Flow for iphone-to-pixel Tool]

![Metadata DateTime Preservation Flow for iphone-to-pixel Tool](https://ppl-ai-code-interpreter-files.s3.amazonaws.com/web/direct-files/429a4062c1dfbd1d9b30c1a3d990862c/e78a3192-ede5-46ee-94ae-916bb0924d94/c7df30a8.png)

Metadata DateTime Preservation Flow for iphone-to-pixel Tool

---

## Practical Implementation Patterns

Here are the specific approaches from existing tools that you should integrate:

### **Approach A: ExifTool Integration** (Most Reliable)

The command that works across JPEG, MP4, WEBP:[^1]

```bash
exiftool -r \
  -tagsfromfile "%d/%F.json" \
  "-DateTimeOriginal<PhotoTakenTimeTimestamp" \
  "-GPSAltitude<GeoDataAltitude" \
  "-GPSLatitude<GeoDataLatitude" \
  "-GPSLongitude<GeoDataLongitude" \
  "-Keywords<Tags" \
  "-Caption-Abstract<Description" \
  -ext "*" \
  -overwrite_original \
  <DirectoryPath>
```

**Your improvement**: Wrap this in your CLI with detection for Google Photos JSON presence.

### **Approach B: Native JSON Parsing** (Best for Your Tool)

Language-specific examples:

**TypeScript/Node.js** (best for your Homebrew tap):

```typescript
interface GooglePhotosJSON {
  photoTakenTimeTimestamp: string;
  photoLastModifiedTime: string;
  geoData?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  description?: string;
  tags?: string[];
}

// Parse JSON timestamp (milliseconds) → proper datetime
const photoTime = parseInt(json.photoTakenTimeTimestamp);
const dateTime = new Date(photoTime);
const exifDateTime = dateTime.toISOString().replace(/T/, ' ').split('.')[^0];
// Result: "2024-01-14 13:04:00"
```

**Key insight**: The `photoTakenTimeTimestamp` is already in the JSON; you just need to:

1. Read it
2. Convert Unix ms → datetime string
3. Write to EXIF
4. Update filesystem mtime

### **Approach C: Fallback Chain** (Robust)

Your tool should try in order:

1. Google Photos JSON sidecar → `photoTakenTimeTimestamp`
2. EXIF `DateTimeOriginal` in file (preserved from upload)
3. Filesystem mtime (last resort)
4. Set filesystem timestamp from whichever source was used

***

## Recommended Implementation for Your Tool

Based on your Homebrew distribution and cross-platform needs:

```
iphone-to-pixel with metadata preservation:

1. Detect input type:
   - Google Takeout ZIP? → Extract, find JSON pairs
   - Unzipped directory? → Scan for .json files
   - Regular library? → Check for EXIF already

2. For each media file:
   a. Try to match .json sidecar (same filename)
   b. Extract photoTakenTimeTimestamp (if exists)
   c. Read file's current EXIF DateTimeOriginal
   d. Use JSON timestamp if available, else EXIF, else mtime
   
3. Write metadata:
   a. Update EXIF DateTimeOriginal to canonical time
   b. Update EXIF ModifyDate if different
   c. Call `touch -t YYYYMMDDHHMM.SS` to set filesystem mtime
   
4. Cleanup:
   a. Remove .json sidecar (metadata now embedded)
   b. Verify timestamp in output file
   c. Report success/conflicts
```


***

## Specific Improvements to Make

1. **Add JSON detection flag**: `--preserve-google-metadata` or `--process-takeout`
2. **Add dry-run mode**: `--verify-dates` to show what would change
3. **Handle timestamp conflicts**: Warn if JSON timestamp differs from EXIF by >1 day
4. **Video support**: Ensure MP4/WEBM metadata handling (trickier than JPEG)
5. **Logging**: Show which timestamp source was used for each file

The key advantage of your tool doing this: users can migrate iPhone→Google Photos→Pixel *once* with `iphone-to-pixel --process-takeout` and never lose capture times again.[^2][^1][^3]

Would you like me to elaborate on any specific implementation detail, or create a more detailed code example for your language of choice?
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://stackoverflow.com/questions/65210140/how-to-merge-json-and-google-takeout-photos-to-get-the-right-dates-back

[^2]: https://www.youtube.com/watch?v=MAOYA91Dqc8

[^3]: https://www.reddit.com/r/googlephotos/comments/1bp8mm9/what_to_do_with_the_json_files/

[^4]: https://www.youtube.com/watch?v=A_itRNhbgZk

[^5]: https://www.youtube.com/watch?v=6G6I7orHc14

[^6]: https://formulae.brew.sh/analytics/cask-install/30d/

[^7]: https://pixelpeeper.com/exif-data-viewer

[^8]: https://www.reddit.com/r/AndroidQuestions/comments/rqhimz/how_do_i_get_my_iphone_photos_to_my_pixel_phone/

[^9]: https://stackoverflow.com/questions/1238838/uiimagepickercontroller-and-extracting-exif-data-from-existing-photos

[^10]: https://github.com/qligier/PixelDngFixer

[^11]: https://auth0.com/blog/read-edit-exif-metadata-in-photos-with-python/

[^12]: https://blog.pics.io/google-photos-metadata-everything-you-need-to-know-about-photo-metadata/

[^13]: https://github.com/Tezumie/Image-to-Pixel

[^14]: https://www.reddit.com/r/GooglePixel/comments/1fgy7hn/getting_the_local_time_or_offset_from_video/

[^15]: https://github.com/xob0t/go-out

