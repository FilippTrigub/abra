#!/usr/bin/env bash
# build-push-images.sh — Build and push all RunPod skill images to Docker Hub.
#
# Usage:
#   ./scripts/build-push-images.sh                  # build + push all 7 skills
#   ./scripts/build-push-images.sh background-remover audio-splitter   # subset
#   PUSH=0 ./scripts/build-push-images.sh            # build only, no push
#   SKIP_EXISTING=1 ./scripts/build-push-images.sh   # skip already-pushed images
#
# Image hierarchy:
#   filipptri/abra-base        ← runpod/pytorch + ffmpeg + runpod + b2sdk + pillow (built first)
#     └── filipptri/abra-{skill}  ← skill-specific deps only (~50-200 MB each)
#
# Requirements:
#   - docker login (run once before this script)
#   - ~80 GB free disk (base image ~12 GB compressed, skills share its layers)
#
# Billing:
#   Public Docker Hub repos are free — no storage or bandwidth charges.
#   RunPod is billed per-second of GPU compute only when jobs run.

set -euo pipefail

REGISTRY="filipptri"
IMAGE_PREFIX="abra"
PLATFORM="linux/amd64"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${REPO_ROOT}/.build-logs"
PUSH="${PUSH:-1}"
SKIP_EXISTING="${SKIP_EXISTING:-0}"

ALL_SKILLS=(
  audio-splitter
  background-remover
  bokeh-effect
  frame-interpolator
  photo-picker
  video-editor
  video-matte
)

# Use explicit list if arguments provided, otherwise build all
if [[ $# -gt 0 ]]; then
  SKILLS=("$@")
else
  SKILLS=("${ALL_SKILLS[@]}")
fi

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

echo "==> Pre-flight checks"

# Docker daemon running
if ! docker info &>/dev/null; then
  echo "ERROR: Docker daemon is not running." >&2
  exit 1
fi

# Logged in to Docker Hub (needed for push)
if [[ "$PUSH" == "1" ]]; then
  if ! docker system info --format '{{.RegistryConfig.IndexConfigs}}' 2>/dev/null | grep -q "index.docker.io"; then
    echo "WARNING: Not logged in to Docker Hub. Run 'docker login' first." >&2
    echo "         Continuing build — push will fail if not authenticated." >&2
  fi
fi

# Disk space check: require at least 50 GB free
FREE_GB=$(df -BG "${REPO_ROOT}" | awk 'NR==2 {gsub("G",""); print $4}')
if [[ "$FREE_GB" -lt 50 ]]; then
  echo "ERROR: Only ${FREE_GB} GB free in ${REPO_ROOT}. Need at least 50 GB." >&2
  exit 1
fi
echo "    Disk: ${FREE_GB} GB free — OK"

# All Dockerfiles exist
for skill in "${SKILLS[@]}"; do
  dockerfile="${REPO_ROOT}/docker/${skill}/Dockerfile"
  if [[ ! -f "$dockerfile" ]]; then
    echo "ERROR: Dockerfile not found: ${dockerfile}" >&2
    exit 1
  fi
done
echo "    Dockerfiles: all present — OK"
echo ""

mkdir -p "$LOG_DIR"

# ---------------------------------------------------------------------------
# Base image — build and push first (all skill images depend on it)
# ---------------------------------------------------------------------------

BASE_IMAGE="${REGISTRY}/${IMAGE_PREFIX}-base:latest"
BASE_LOG="${LOG_DIR}/base.log"
mkdir -p "$LOG_DIR"

_build_base=1
if [[ "$SKIP_EXISTING" == "1" ]] && docker manifest inspect "${BASE_IMAGE}" &>/dev/null; then
  echo "==> Base image already on Docker Hub — skipping"
  _build_base=0
fi

if [[ "$_build_base" == "1" ]]; then
  echo "==> Building base image: ${BASE_IMAGE}"
  base_start=$(date +%s)
  if ! docker build \
    --platform "${PLATFORM}" \
    --file "${REPO_ROOT}/docker/base/Dockerfile" \
    --tag "${BASE_IMAGE}" \
    "${REPO_ROOT}" \
    > "$BASE_LOG" 2>&1; then
    echo "ERROR: base image build failed — see ${BASE_LOG}" >&2
    exit 1
  fi
  echo "    Build : $(( $(date +%s) - base_start ))s"

  if [[ "$PUSH" == "1" ]]; then
    echo "    Pushing base image..."
    if ! docker push "${BASE_IMAGE}" >> "$BASE_LOG" 2>&1; then
      echo "ERROR: base image push failed — see ${BASE_LOG}" >&2
      exit 1
    fi
    echo "    Push  : done"
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# Build + push loop
# ---------------------------------------------------------------------------

FAILED=()
SKIPPED=()
BUILT=()

total="${#SKILLS[@]}"
idx=0

for skill in "${SKILLS[@]}"; do
  idx=$((idx + 1))
  image="${REGISTRY}/${IMAGE_PREFIX}-${skill}:latest"
  logfile="${LOG_DIR}/${skill}.log"

  echo "==> [${idx}/${total}] ${skill}"
  echo "    Image : ${image}"
  echo "    Log   : ${logfile}"

  # Skip if already exists on registry
  if [[ "$SKIP_EXISTING" == "1" ]]; then
    if docker manifest inspect "${image}" &>/dev/null; then
      echo "    Status: already on Docker Hub — skipping"
      SKIPPED+=("$skill")
      continue
    fi
  fi

  start_ts=$(date +%s)

  # Build
  echo "    Building..."
  if ! docker build \
    --platform "${PLATFORM}" \
    --file "${REPO_ROOT}/docker/${skill}/Dockerfile" \
    --tag "${image}" \
    "${REPO_ROOT}" \
    > "$logfile" 2>&1; then
    echo "    ERROR: build failed — see ${logfile}"
    FAILED+=("$skill")
    continue
  fi

  build_secs=$(( $(date +%s) - start_ts ))
  echo "    Build : ${build_secs}s"

  # Image size
  size=$(docker image inspect "${image}" --format '{{.Size}}' | awk '{printf "%.1f GB", $1/1024/1024/1024}')
  echo "    Size  : ${size}"

  # Push
  if [[ "$PUSH" == "1" ]]; then
    echo "    Pushing..."
    if ! docker push "${image}" >> "$logfile" 2>&1; then
      echo "    ERROR: push failed — see ${logfile}"
      FAILED+=("$skill")
      continue
    fi
    push_secs=$(( $(date +%s) - start_ts - build_secs ))
    echo "    Push  : ${push_secs}s"
  fi

  total_secs=$(( $(date +%s) - start_ts ))
  echo "    Done  : ${total_secs}s total"
  BUILT+=("$skill")
  echo ""
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo "============================================================"
echo " Summary"
echo "============================================================"

if [[ ${#BUILT[@]} -gt 0 ]]; then
  echo " Built + pushed (${#BUILT[@]}):"
  for s in "${BUILT[@]}"; do
    echo "   ✓ ${REGISTRY}/${IMAGE_PREFIX}-${s}:latest"
  done
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo " Skipped / already exist (${#SKIPPED[@]}):"
  for s in "${SKIPPED[@]}"; do
    echo "   - ${s}"
  done
fi

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo " FAILED (${#FAILED[@]}):"
  for s in "${FAILED[@]}"; do
    echo "   ✗ ${s}  (log: ${LOG_DIR}/${s}.log)"
  done
  echo ""
  exit 1
fi

echo ""
echo "All done. Next step: run 'claude' and ask to deploy RunPod endpoints."
