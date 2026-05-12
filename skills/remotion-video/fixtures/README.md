This fixture bundle is intentionally small and deterministic.

- `render-spec.valid.json` reuses repo fixtures from `tests/fixtures/`.
- `render-spec.invalid.missing-composition.json` is expected to fail validation before any render attempt.
- No new binary media is committed for Remotion task 7.

Checks:

```bash
cd skills/remotion-video
uv run python scripts/preflight.py check-fixtures
uv run python scripts/preflight.py validate-spec --spec fixtures/render-spec.valid.json
uv run python scripts/preflight.py check-runtime --skip-browser-ensure
```
