# Video2MD integration assessment

Source inspected: `E:/Coding/项目/Video2MD-master` (README, Python GUI and conversion core). No files in that project were modified.

## Observed Implementation

- `monitor.py` uses PyQt6: it is a desktop UI, not an embeddable web page.
- `video2md.py` exposes a CLI and `process_video` conversion core; it uses yt-dlp, ffmpeg/ffprobe, and optional faster-whisper transcription.
- Output is a Markdown document plus a sibling `<title>_assets` directory containing screenshots. Image references are relative paths.
- Sources include local video files and supported video URLs. Some operations use platform cookies. Cookies must never become shared website upload assets or appear in logs.
- README estimates a 1.5 GB medium model and 4 GB+ memory for transcription. Actual server capacity and processing time need measurement before enabling conversion.
- No root-project LICENSE was found. Bundled dependency licenses are not a license to redistribute this application. Confirm ownership/license before copying code or publishing desktop packages.

## Proposed Delivery Order

1. Integrate output import into the Markdown editor: choose an `.md` document and its image folder, preview locally, upload images under the authenticated user's ownership, rewrite only parsed relative image references, and save an article draft.
2. Reject directory traversal, unsupported/oversized images, missing assets, and conflicting filenames. Do not publish the draft automatically. Internal-note images must use the protected internal bucket.
3. Provide a locally executed CLI/skill recipe for a user's agent. Conversion stays on the user's computer initially; the website receives only the reviewed output, not browser cookies or private video sources.
4. Add an isolated asynchronous server worker only after capacity and licensing review. Use bounded queue, per-user quotas, timeouts, cancellation, temporary storage cleanup, and a service account distinct from the web backend.
5. Any URL-processing worker requires network egress restrictions and private-address/redirect blocking to prevent SSRF. Pass arguments as an array, never interpolate user input into a shell. Restrict ffmpeg resource use and avoid arbitrary executable uploads.

## Acceptance Tests

- Unicode/spaced filenames, nested assets, multiple images, missing assets, formulas and code blocks round-trip without corrupting Markdown.
- User cancels import, upload fails halfway, or the network disconnects: draft is not silently published and partial files can be cleaned up.
- Internal images remain unavailable to unauthorized readers.
- Source attribution is preserved. Users confirm rights to the uploaded video, transcript and screenshots.

Current status: source assessment complete; no web converter, worker, MCP endpoint or importer is claimed implemented yet.
