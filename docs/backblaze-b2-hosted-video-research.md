# Hosted video staging research for Buffer scheduling

## Findings

- Buffer scheduled video posts need a direct, unauthenticated `GET` URL for the raw video file.
- Local `shareNow` video keeps working with the existing `cloudflared` tunnel because Buffer fetches immediately.
- Scheduled or queued local video needs durable staging instead of a short-lived tunnel.

## Why `temp.sh` was rejected

- `temp.sh` returned an HTML wrapper page on normal `GET` requests.
- The raw file was only returned in a different request flow, which does not match Buffer's fetch behavior.
- That made it unsuitable for scheduled Buffer video posts even though upload looked simple.

## Why Backblaze B2 is the cheapest functional option

- B2's native API is small enough to use directly with `requests` and the standard library.
- The flow is straightforward: `b2_authorize_account` → `b2_get_upload_url` → upload file.
- An `allPublic` bucket gives a stable public file URL in the form `/file/<bucket-name>/<file-name>` with no signed URL requirement.
- That makes B2 a low-complexity and low-cost staging backend that still satisfies Buffer's direct-download requirement.
- B2 retention is operationally controlled by your bucket lifecycle and deletion policy, so the scheduler assumes the bucket is managed to outlive the scheduled posting window.

## Required environment variables

- `BACKBLAZE_B2_KEY_ID`
- `BACKBLAZE_B2_APPLICATION_KEY`
- `BACKBLAZE_B2_BUCKET_ID`
- `BACKBLAZE_B2_BUCKET_NAME`

## Retention rule kept intentionally strict

- Unknown retention remains forbidden.
- Staging is only allowed when provider retention is strictly greater than `(time-until-post) + 12h`.

## Verified outcome in this repo

- The B2 staging flow was verified end-to-end against the live Buffer/Instagram path.
- Working path: local MP4 → B2 upload → public B2 file URL → Buffer scheduled Reel.
- The staged URL was successfully HEAD-probed and later appeared in Buffer as the
  scheduled post asset source.
- The final blocker was not hosting-related but platform-related: Instagram Reels
  rejected a 2-second fixture with `Video must be at least 3 seconds for Instagram Reels.`
- Extending that clip to ~4 seconds made the scheduled Reel succeed.
