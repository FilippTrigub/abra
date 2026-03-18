# Video Upload Bug — post-scheduler

## Symptom

Scheduled posts created with a local video file via `--video-url path/to/video.mp4`
appear in Buffer with an empty video attachment. The post is created successfully
(Buffer returns `PostActionSuccess` with a valid post ID), but no video is visible
in Buffer's dashboard or published to Instagram.

## Investigation

### What we tried

1. Local file via cloudflared tunnel → `customScheduled` → **empty video**
2. Local file via cloudflared tunnel → `customScheduled` (69 MB H.265) → **empty video**
3. Persistent public HTTPS URL → `customScheduled` → **video present** ✓

### Key findings

**Buffer's GraphQL API response fields are not reliable monitoring signals.**
`VideoAsset.id`, `thumbnail`, `videoCodec`, `containerFormat`, and `isVideoProcessing`
all remain `null`/`""` even for posts where the video is fully present and working.
Do not use these fields to determine success or failure.

**Buffer stores the URL as a reference, not the video bytes.**
The `source` field always retains the original URL passed to the mutation — Buffer
does not rewrite it to a CDN URL. This means Buffer fetches (or attempts to fetch)
the video from that URL either asynchronously after creation or at publish time.

**The cloudflared tunnel dies before Buffer uses the URL.**
The tunnel is alive for roughly 100 seconds (10 s propagation + probe + API call +
`--tunnel-wait`). Buffer's video fetch happens later — after the script exits and
the tunnel process is gone. The URL returns 404 and the video is lost.

**This is mode-dependent.**

| Mode | Tunnel still alive at fetch time? | Result |
|---|---|---|
| `shareNow` | Likely yes (publish is immediate) | Should work |
| `addToQueue` | No | Fails |
| `shareNext` | No | Fails |
| `customScheduled` | No | Fails |
| `recommendedTime` | No | Fails |

### Why it "worked before"

The cloudflared fix (commit `65bfa96`) was tested by confirming the API accepted
the request without error. It was not verified end-to-end (i.e., that the video
actually appeared on the published post). The underlying fetch-at-publish-time
behavior means the fix only works for `shareNow` mode.

### The `schedulingType` field

`schedulingType: "automatic"` is a **required** field in `CreatePostInput`. Removing
it causes a `BAD_USER_INPUT` GraphQL error. It must always be present regardless of
`mode`. Do not remove it.

## Root Cause

The cloudflared tunnel approach is **architecturally incompatible** with any
scheduling mode other than `shareNow`. Buffer stores the tunnel URL as a reference
and fetches the video later; by that point the tunnel process has exited and the
URL is dead.

## Fix

### Short-term (implemented)

- Detect the incompatible combination: local video file + non-`shareNow` mode
- Exit with a clear error message directing the user to use a persistent URL
- `shareNow` with a local file continues to work via tunnel (publish is immediate)
- Images are unaffected (Buffer appears to handle them differently / faster)

### Persistent URL options for scheduled video posts

1. **Google Drive** — already supported. Upload the video to Drive, share with
   "Anyone with the link", pass the share URL to `--video-url`. The script
   auto-converts it to a direct-download URL.

2. **Any public HTTPS URL** — a CDN, S3 bucket, or any server that serves the
   file at a stable URL works out of the box. Pass the URL directly.

## Other bugs fixed in this session

| # | Bug | Fix |
|---|-----|-----|
| 1 | `finally` block slept for `--tunnel-wait` seconds even when the API call failed (HTTP error / GraphQL error), delaying the error exit by 60 s | Added `api_succeeded` flag; sleep is skipped on failure |
| 2 | `--tunnel-wait` defaulted to 60 s in code but SKILL.md documented 90 s | Aligned both to 90 s |
