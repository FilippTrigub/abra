"""
test_workflows.py — Tests for workflow orchestration.

Tests the workflow runner (run.py) as a black box via subprocess.
Does NOT test individual skills (already tested in test_*.py).
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent
WORKFLOWS_DIR = REPO_ROOT / "workflows"
RUNNER = WORKFLOWS_DIR / "run.py"

FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"
TEST_CLIP = FIXTURES_DIR / "clip_5s.mp4"


@pytest.fixture
def runner():
    return [sys.executable, str(RUNNER)]


class TestConfigDiscovery:
    """Workflow config loading and validation."""

    def test_discovers_creative_workflows(self):
        creative = WORKFLOWS_DIR / "creative"
        assert creative.exists()
        workflows = list(creative.iterdir())
        assert len(workflows) >= 3

    def test_discovers_brand_workflows(self):
        brand = WORKFLOWS_DIR / "brand"
        assert brand.exists()
        workflows = list(brand.iterdir())
        assert len(workflows) >= 1

    def test_workflow_has_required_fields(self):
        for subdir in ["creative", "brand"]:
            base = WORKFLOWS_DIR / subdir
            for wf_dir in base.iterdir():
                if wf_dir.is_dir():
                    config = wf_dir / "config.json"
                    assert config.exists(), f"Missing config in {wf_dir}"
                    data = json.loads(config.read_text())
                    assert "name" in data
                    assert "steps" in data
                    assert len(data["steps"]) > 0


class TestWorkflowExecution:
    """Step execution and data flow."""

    def test_runner_help_works(self, runner):
        result = subprocess.run(runner + ["--help"], capture_output=True)
        assert result.returncode == 0
        assert "workflow" in result.stdout.decode().lower()

    def test_runner_missing_workflow_shows_available(self, runner):
        result = subprocess.run(
            runner + ["--workflow", "nonexistent", "--input", "/tmp"],
            capture_output=True,
        )
        assert result.returncode != 0
        output = result.stderr.decode()
        assert "video-to-reel" in output or "image-to-post" in output

    def test_runner_missing_input_shows_error(self, runner):
        result = subprocess.run(
            runner + ["--workflow", "video-to-reel", "--input", "/tmp/nonexistent"],
            capture_output=True,
        )
        assert result.returncode != 0
        assert (
            "not found" in result.stderr.decode().lower()
            or "input" in result.stderr.decode().lower()
        )


class TestWorkflowSchema:
    """Validate workflow step ordering."""

    def test_brand_manager_first(self):
        for subdir in ["creative"]:
            base = WORKFLOWS_DIR / subdir
            if not base.exists():
                continue
            for wf_dir in base.iterdir():
                if not wf_dir.is_dir():
                    continue
                config = json.loads((wf_dir / "config.json").read_text())
                steps = config.get("steps", [])
                if not steps:
                    continue
                first_step = steps[0]
                if first_step.get("skill") == "brand-manager":
                    assert first_step.get("action") == "refresh"

    def test_post_scheduler_last(self):
        for subdir in ["creative"]:
            base = WORKFLOWS_DIR / subdir
            if not base.exists():
                continue
            for wf_dir in base.iterdir():
                if not wf_dir.is_dir():
                    continue
                config = json.loads((wf_dir / "config.json").read_text())
                steps = config.get("steps", [])
                if not steps:
                    continue
                last_step = steps[-1]
                assert last_step.get("skill") == "post-scheduler"


class TestOptionalSteps:
    """Optional step skipping."""

    def test_skip_optional_flag_accepted(self, runner):
        result = subprocess.run(
            runner + ["--help"],
            capture_output=True,
        )
        assert (
            "--skip-optional" in result.stdout.decode()
            or "-s" in result.stdout.decode()
        )


class TestDeviceFlag:
    """Device parameter passing."""

    def test_device_flag_accepted(self, runner):
        result = subprocess.run(
            runner + ["--help"],
            capture_output=True,
        )
        output = result.stdout.decode()
        assert "--device" in output or "-d" in output


class TestArchiveFlag:
    """Archive behavior."""

    def test_no_archive_flag_accepted(self, runner):
        result = subprocess.run(
            runner + ["--help"],
            capture_output=True,
        )
        assert "--no-archive" in result.stdout.decode()
