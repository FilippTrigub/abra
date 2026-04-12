from __future__ import annotations

import json
import time
from dataclasses import dataclass
from urllib.error import HTTPError
from urllib.request import Request, urlopen

RUNPOD_API_BASE = "https://api.runpod.ai/v2"

_POLL_INTERVAL = 5  # seconds between status checks
_TERMINAL_STATUSES = frozenset({"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"})


@dataclass(frozen=True)
class RunpodClient:
    api_key: str
    endpoint_id: str
    timeout_seconds: int = 600

    def submit(self, payload: dict) -> str:
        """POST job to /run, return job_id."""
        url = f"{RUNPOD_API_BASE}/{self.endpoint_id}/run"
        body = json.dumps({"input": payload}).encode()
        req = Request(
            url,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
        except HTTPError as exc:
            raise RuntimeError(
                f"RunPod submit failed ({exc.code}): {exc.read().decode(errors='replace')}"
            ) from exc

        job_id = result.get("id")
        if not job_id:
            raise RuntimeError(f"RunPod submit returned no job ID: {result}")
        return job_id

    def poll(self, job_id: str) -> dict:
        """Poll /status/{job_id} until terminal state. Return output dict."""
        url = f"{RUNPOD_API_BASE}/{self.endpoint_id}/status/{job_id}"
        deadline = time.monotonic() + self.timeout_seconds

        while True:
            req = Request(url, headers={"Authorization": f"Bearer {self.api_key}"})
            try:
                with urlopen(req, timeout=30) as resp:
                    result = json.loads(resp.read())
            except HTTPError as exc:
                raise RuntimeError(
                    f"RunPod status check failed ({exc.code}): "
                    f"{exc.read().decode(errors='replace')}"
                ) from exc

            status = result.get("status", "")

            if status in _TERMINAL_STATUSES:
                if status != "COMPLETED":
                    error = result.get("error") or (
                        result.get("output", {}) or {}
                    ).get("error", "unknown error")
                    raise RuntimeError(
                        f"RunPod job {job_id} ended with status {status}: {error}"
                    )
                output = result.get("output") or {}
                if isinstance(output, dict) and "error" in output:
                    raise RuntimeError(
                        f"RunPod job {job_id} handler error: {output['error']}"
                    )
                return output

            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"RunPod job {job_id} did not complete within "
                    f"{self.timeout_seconds}s (last status: {status})"
                )

            time.sleep(_POLL_INTERVAL)
