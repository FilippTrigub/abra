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

### Current implementation

- `shareNow` with a local video still uses `cloudflared`
- Scheduled/queued local videos now support explicit staging providers instead of
  relying on the short-lived tunnel
- `0x0.st` remains supported in code as a fixed-retention temp host option
- `backblaze-b2` is now supported as the practical persistent-hosting path for
  scheduled local videos
- Backblaze B2 is treated as operator-managed persistent storage: the bucket must
  already be `allPublic`, and the bucket lifecycle/deletion policy must outlive
  the scheduling window

### Verified working path

This issue is now resolved for scheduled local videos when the media is staged to
Backblaze B2 first.

Verified flow:

1. Local MP4 passed to `--video-url`
2. Scheduler uploads it via the B2 native API
3. Scheduler constructs a public B2 URL and verifies it
4. Buffer accepts the post and stores the staged B2 URL as the asset source
5. Scheduled Instagram Reel appears in Buffer successfully

### Remaining caveats

- `cloudflared` is still only valid for local `shareNow` video posts
- Temp hosts that serve HTML wrappers on `GET` are still incompatible
- Instagram Reels have their own media rules; during verification Buffer/Instagram
  rejected a 2-second test clip with `Video must be at least 3 seconds for Instagram Reels.`

### Persistent URL options for scheduled video posts

1. **Backblaze B2** — cheapest repo-supported persistent staging option for local scheduled videos.
2. **Google Drive** — technically supported by URL conversion, but was reported unreliable in practice for video uploads.
3. **Any public HTTPS direct-download URL** — CDN, object storage, or other raw-file host that serves the media bytes on normal unauthenticated `GET`.

## Other bugs fixed in this session

| # | Bug | Fix |
|---|-----|-----|
| 1 | `finally` block slept for `--tunnel-wait` seconds even when the API call failed (HTTP error / GraphQL error), delaying the error exit by 60 s | Added `api_succeeded` flag; sleep is skipped on failure |
| 2 | `--tunnel-wait` defaulted to 60 s in code but SKILL.md documented 90 s | Aligned both to 90 s |
