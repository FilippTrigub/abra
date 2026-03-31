"""
test_workflows.py — Tests for workflow orchestration.

Tests the workflow runner (run.py) as a black box via subprocess.
Does NOT test individual skills (already tested in test_*.py).
"""

import json
import importlib.util
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

pytest = __import__("pytest")

REPO_ROOT = Path(__file__).parent.parent
WORKFLOWS_DIR = REPO_ROOT / "workflows"
RUNNER = WORKFLOWS_DIR / "run.py"

FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"
TEST_CLIP = FIXTURES_DIR / "clip_5s.mp4"


@pytest.fixture
def runner():
    return [sys.executable, str(RUNNER)]


@pytest.fixture(scope="module")
def workflow_run_module():
    spec = importlib.util.spec_from_file_location("workflow_run", RUNNER)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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

    def test_prepare_input_clears_staging_between_runs(
        self, workflow_run_module, tmp_path
    ):
        original_input_dir = workflow_run_module.DEFAULT_INPUT_DIR
        try:
            workflow_run_module.DEFAULT_INPUT_DIR = tmp_path / "input"
            staging = workflow_run_module.DEFAULT_INPUT_DIR / "staging"
            staging.mkdir(parents=True, exist_ok=True)
            (staging / "stale.txt").write_text("old")

            fresh_input = tmp_path / "fresh.txt"
            fresh_input.write_text("new")

            result_dir = workflow_run_module.prepare_input(fresh_input)

            assert result_dir == staging
            assert not (staging / "stale.txt").exists()
            assert (staging / "fresh.txt").exists()
        finally:
            workflow_run_module.DEFAULT_INPUT_DIR = original_input_dir


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


class TestSchedulerIntegration:
    def test_builds_video_scheduler_command_from_defaults_and_overrides(
        self, workflow_run_module, tmp_path, monkeypatch
    ):
        posts_script = tmp_path / "posts.py"
        posts_script.write_text("# stub\n")

        transcript_dir = tmp_path / "transcript"
        transcript_dir.mkdir()
        (transcript_dir / "clip_transcription.json").write_text(
            json.dumps(
                {
                    "segments": [
                        {"text": "First sentence."},
                        {"text": "Second sentence."},
                    ]
                }
            )
        )

        video_dir = tmp_path / "video"
        video_dir.mkdir()
        rendered_video = video_dir / "rendered.mp4"
        rendered_video.write_text("video")

        captured = {}

        def fake_get_skill_script(skill_name: str) -> Path:
            assert skill_name == "post-scheduler"
            return posts_script

        def fake_run(cmd, cwd):
            captured["cmd"] = cmd
            captured["cwd"] = cwd
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(
            workflow_run_module, "get_skill_script", fake_get_skill_script
        )
        monkeypatch.setattr(workflow_run_module.subprocess, "run", fake_run)

        ok = workflow_run_module.run_post_scheduler(
            workflow={"name": "video-to-reel", "input_type": "video"},
            latest_media_output=video_dir,
            transcript_output=transcript_dir,
            caption_output=None,
            defaults={
                "mode": "customScheduled",
                "ig_type": "reel",
                "video_staging_provider": "backblaze-b2",
            },
            overrides={
                "channel_id": "chan_123",
                "due_at": "2026-04-01T12:00:00Z",
            },
        )

        assert ok is True
        assert captured["cwd"] == posts_script.parent
        assert captured["cmd"] == [
            sys.executable,
            str(posts_script),
            "create",
            "--channel-id",
            "chan_123",
            "--text",
            "First sentence. Second sentence.",
            "--mode",
            "customScheduled",
            "--due-at",
            "2026-04-01T12:00:00Z",
            "--video-url",
            str(rendered_video),
            "--video-staging-provider",
            "backblaze-b2",
            "--ig-type",
            "reel",
        ]

    def test_image_workflow_uses_latest_media_output_for_scheduler(
        self, workflow_run_module, tmp_path, monkeypatch
    ):
        staging = tmp_path / "staging"
        staging.mkdir()
        (staging / "raw.jpg").write_text("raw")

        output_dir = tmp_path / "output"
        posts_script = tmp_path / "posts.py"
        posts_script.write_text("# stub\n")

        captured = {}

        workflow = {
            "name": "image-to-post",
            "description": "Test image scheduling workflow",
            "input_type": "image",
            "steps": [
                {
                    "name": "brand-refresh",
                    "skill": "brand-manager",
                    "action": "refresh",
                    "description": "Refresh",
                },
                {
                    "name": "resize",
                    "skill": "social-resizer",
                    "description": "Resize image",
                },
                {
                    "name": "caption",
                    "skill": "image-captioner",
                    "description": "Caption image",
                },
                {
                    "name": "schedule",
                    "skill": "post-scheduler",
                    "description": "Schedule image",
                    "params": {"mode": "shareNow"},
                },
            ],
        }

        def fake_load_workflow(name: str) -> dict:
            assert name == "image-to-post"
            return workflow

        def fake_prepare_input(input_path: Path) -> Path:
            return staging

        def fake_run_skill(
            skill_name, input_dir, step_output, params=None, device="auto"
        ):
            if skill_name == "social-resizer":
                (step_output / "resized.jpg").write_text("image")
            elif skill_name == "image-captioner":
                (step_output / "caption.json").write_text(
                    json.dumps({"caption": "Caption from sidecar."})
                )
            else:
                raise AssertionError(f"Unexpected skill {skill_name}")
            return True

        def fake_get_skill_script(skill_name: str) -> Path:
            assert skill_name == "post-scheduler"
            return posts_script

        def fake_subprocess_run(cmd, cwd):
            captured["cmd"] = cmd
            captured["cwd"] = cwd
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(workflow_run_module, "load_workflow", fake_load_workflow)
        monkeypatch.setattr(workflow_run_module, "prepare_input", fake_prepare_input)
        monkeypatch.setattr(workflow_run_module, "run_skill", fake_run_skill)
        monkeypatch.setattr(
            workflow_run_module, "get_skill_script", fake_get_skill_script
        )
        monkeypatch.setattr(workflow_run_module.subprocess, "run", fake_subprocess_run)

        ok = workflow_run_module.run_workflow(
            workflow_name="image-to-post",
            input_path=tmp_path / "input.jpg",
            output_path=output_dir,
            archive=False,
            scheduler_overrides={"channel_id": "chan_456"},
        )

        assert ok is True
        assert "--text" in captured["cmd"]
        assert "Caption from sidecar." in captured["cmd"]
        image_url_index = captured["cmd"].index("--image-url") + 1
        assert captured["cmd"][image_url_index].endswith("resized.jpg")
        assert not captured["cmd"][image_url_index].endswith("caption.json")

    def test_scheduler_workflow_requires_actual_channel_id(
        self, workflow_run_module, tmp_path, monkeypatch
    ):
        image_dir = tmp_path / "images"
        image_dir.mkdir()
        (image_dir / "photo.jpg").write_text("image")

        caption_dir = tmp_path / "captions"
        caption_dir.mkdir()
        (caption_dir / "caption.json").write_text(
            json.dumps({"caption": "Caption from sidecar."})
        )

        called = {"subprocess": False}

        def fake_subprocess_run(cmd, cwd):
            called["subprocess"] = True
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(workflow_run_module.subprocess, "run", fake_subprocess_run)

        ok = workflow_run_module.run_post_scheduler(
            workflow={"name": "image-to-post", "input_type": "image"},
            latest_media_output=image_dir,
            transcript_output=None,
            caption_output=caption_dir,
            defaults={"mode": "shareNow"},
            overrides=None,
        )

        assert ok is False
        assert called["subprocess"] is False

    def test_scheduler_rejects_platform_name_as_channel_id(
        self, workflow_run_module, tmp_path, monkeypatch
    ):
        video_dir = tmp_path / "video"
        video_dir.mkdir()
        (video_dir / "rendered.mp4").write_text("video")

        transcript_dir = tmp_path / "transcript"
        transcript_dir.mkdir()
        (transcript_dir / "clip_transcription.json").write_text(
            json.dumps({"segments": [{"text": "hello world"}]})
        )

        called = {"subprocess": False}

        def fake_subprocess_run(cmd, cwd):
            called["subprocess"] = True
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(workflow_run_module.subprocess, "run", fake_subprocess_run)

        ok = workflow_run_module.run_post_scheduler(
            workflow={"name": "video-to-reel", "input_type": "video"},
            latest_media_output=video_dir,
            transcript_output=transcript_dir,
            caption_output=None,
            defaults={
                "mode": "customScheduled",
                "video_staging_provider": "backblaze-b2",
            },
            overrides={
                "channel_id": "instagram",
                "due_at": "2026-04-01T12:00:00Z",
            },
        )

        assert ok is False
        assert called["subprocess"] is False
