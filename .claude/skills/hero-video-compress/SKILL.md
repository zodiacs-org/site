---
name: hero-video-compress
description: >-
  Use when a website's hero or background video loads slowly and should be
  shrunk with no visible quality loss, by re-encoding its AV1 and H.264 files
  with ffmpeg, checking SSIM, and swapping them in under the same filenames.
---
# Shrink a site hero video without visible quality loss

The idea comes from a well-known X tip: re-encode with modern settings and you can often save a lot. Expect 15 to 40% on files that were already compressed well, and much more on raw exports.

## 1. Find the files
- Find the `<video>` sources in the page or component code. Sites usually ship two files: an AV1 `.mp4` (or `.webm`), which most browsers play, and an H.264 `.mp4` fallback.
- Record each file's size, resolution, frame rate and duration with `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate -of compact file.mp4`.
- Check whether two "different" heroes are really the same file, for example because one domain redirects to the other.

## 2. Re-encode at a few quality levels
Keep the same resolution and frame rate, with no audio (`-an`, since heroes are muted) and `-movflags +faststart` so the video starts streaming quickly.
- AV1: `ffmpeg -i src.mp4 -c:v libsvtav1 -preset 4 -crf 40 -pix_fmt yuv420p -g 240 -an -movflags +faststart out-av1-crf40.mp4`. Also try CRF 44.
- H.264: `ffmpeg -i src.mp4 -c:v libx264 -preset veryslow -crf 26 -profile:v high -pix_fmt yuv420p -an -movflags +faststart out-h264-crf26.mp4`. Also try CRF 28.
- For a looping hero, make sure the first and last frames still join seamlessly.

## 3. Check quality
- SSIM against the source: `ffmpeg -i out.mp4 -i src.mp4 -lavfi ssim -f null -`. Aim for about 0.98 or higher.
- Make a side-by-side still comparison PNG from a busy frame, look at it, and show it to the user.
- Pick the smallest file with no difference you can see. If going smaller starts to show banding or blur, stop there and report the honest savings. Don't force the 80 to 90% figure.

## 4. Ship
- Replace the files under the same names, so no code changes are needed.
- Open a PR with a before and after size table (MB and %), plus a note that SSIM was checked. Follow the repo's merge rules, then confirm the live page serves the new sizes, for example with `curl -sI` and its Content-Length.

## Reference result
Two hero videos, a 1080p 24fps landscape loop and a vertical 25fps clip:
- AV1 at CRF ~40 to 44 saved 16 to 39%.
- H.264 at CRF ~26 to 28 saved 31%.
- There was no visible loss in either.
