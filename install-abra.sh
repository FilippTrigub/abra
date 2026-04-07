#!/bin/bash
# NOTE (container path): AGENT_WORKSPACE_CONTAINER is hardcoded to /home/node/.openclaw.
# This assumes OpenClaw runs inside a Docker container as the 'node' user, with the host
# ~/.openclaw directory volume-mounted at /home/node/.openclaw. If you ever switch to a
# native (non-containerised) install, set CONTAINER_OPENCLAW_DIR="${HOME}/.openclaw".
set -e
AGENT_NAME="abra"
AGENT_DISPLAY_NAME="Abra"
REPO_URL="${REPO_URL:-https://github.com/FilippTrigub/abra.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
HOST_OPENCLAW_DIR="${HOME}/.openclaw"
CONTAINER_OPENCLAW_DIR="/home/node/.openclaw"
AGENT_WORKSPACE_HOST="${HOST_OPENCLAW_DIR}/workspace-${AGENT_NAME}"
AGENT_WORKSPACE_CONTAINER="${CONTAINER_OPENCLAW_DIR}/workspace-${AGENT_NAME}"
SKILLS_DEST="${AGENT_WORKSPACE_HOST}/skills"
CONFIG_FILE="${HOST_OPENCLAW_DIR}/openclaw.json"
POST_SCHEDULER_ENV_FILE="${HOST_OPENCLAW_DIR}/post-scheduler-backblaze.env"
POST_SCHEDULER_ENV_FILE_CONTAINER="${CONTAINER_OPENCLAW_DIR}/post-scheduler-backblaze.env"
LEGACY_POST_SCHEDULER_ENV_FILE="${AGENT_WORKSPACE_HOST}/skills/post-scheduler/.env"

read_env_value() {
    local file="$1"
    local key="$2"
    [ -f "${file}" ] || return 0

    python3 - "$file" "$key" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]

for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    current_key, raw_value = line.split("=", 1)
    if current_key.strip() != key:
        continue
    value = raw_value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    print(value.strip())
    break
PY
}

read_config_env_value() {
    local file="$1"
    local key="$2"
    [ -f "${file}" ] || return 0

    jq -r --arg key "${key}" '.env[$key] // empty' "${file}"
}

escape_env_value() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '%s' "${value}"
}

resolve_installer_env_value() {
    local key="$1"
    local value="${!key:-}"

    if [ -n "${value}" ]; then
        printf '%s' "${value}"
        return 0
    fi

    value="$(read_config_env_value "${CONFIG_FILE}" "${key}")"
    if [ -n "${value}" ]; then
        printf '%s' "${value}"
        return 0
    fi

    if [ -n "${ROOT_ENV_FILE:-}" ]; then
        value="$(read_env_value "${ROOT_ENV_FILE}" "${key}")"
    fi

    printf '%s' "${value}"
}

prompt_secret_value() {
    local label="$1"
    local current_value="$2"
    local response=""

    if [ ! -t 0 ]; then
        printf '%s' "${current_value}"
        return 0
    fi

    if [ -n "${current_value}" ]; then
        read -r -s -p "${label} [configured, press Enter to keep current]: " response
    else
        read -r -s -p "${label}: " response
    fi
    echo

    if [ -n "${response}" ]; then
        printf '%s' "${response}"
        return 0
    fi

    printf '%s' "${current_value}"
}

copy_directory_clean() {
    local source_dir="$1"
    local destination_dir="$2"

    python3 - "$source_dir" "$destination_dir" <<'PY'
from pathlib import Path
import os
import shutil
import sys

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
backup = destination.with_name(f".{destination.name}.install-backup-{os.getpid()}")

ignored_names = {".venv", "__pycache__", ".claude", ".pytest_cache"}
ignored_suffixes = (".pyc", ".pyo")

if backup.exists():
    shutil.rmtree(backup, ignore_errors=True)

if destination.exists():
    destination.rename(backup)

def ignore(_current_dir: str, names: list[str]) -> list[str]:
    skipped: list[str] = []
    for name in names:
        if name in ignored_names or name.endswith(ignored_suffixes):
            skipped.append(name)
    return skipped

try:
    shutil.copytree(source, destination, ignore=ignore)
except Exception:
    shutil.rmtree(destination, ignore_errors=True)
    if backup.exists() and not destination.exists():
        backup.rename(destination)
    raise

if backup.exists():
    shutil.rmtree(backup, ignore_errors=True)
PY
}

resolve_openclaw_owner() {
    local owner=""

    if [ "$(id -u)" -ne 0 ]; then
        return 0
    fi

    if [ -n "${SUDO_UID:-}" ] && [ -n "${SUDO_GID:-}" ]; then
        printf '%s:%s' "${SUDO_UID}" "${SUDO_GID}"
        return 0
    fi

    if [ -e "${HOST_OPENCLAW_DIR}" ]; then
        owner="$(stat -c '%u:%g' "${HOST_OPENCLAW_DIR}")"
        if [ "${owner%%:*}" -ne 0 ]; then
            printf '%s' "${owner}"
            return 0
        fi
    fi

    owner="$(stat -c '%u:%g' "$(dirname "${HOST_OPENCLAW_DIR}")")"
    if [ "${owner%%:*}" -ne 0 ]; then
        printf '%s' "${owner}"
    fi
}

normalize_openclaw_ownership() {
    local owner="$1"

    if [ -z "${owner}" ] || [ ! -d "${HOST_OPENCLAW_DIR}" ]; then
        return 0
    fi

    chown -R "${owner}" "${HOST_OPENCLAW_DIR}"
}

set_config_env_value() {
    local key="$1"
    local value="$2"

    if [ -z "${value}" ]; then
        echo "  • openclaw.json env.${key} not set (no value provided)"
        return 0
    fi

    jq --arg key "${key}" --arg value "${value}" '.env[$key] = $value' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
    echo "  ✓ openclaw.json env.${key}"
}

configure_skill_api_keys() {
    local buffer_api_key giphy_api_key freesound_api_key pixabay_api_key hf_token replicate_api_token

    buffer_api_key="$(resolve_installer_env_value "BUFFER_API_KEY")"
    giphy_api_key="$(resolve_installer_env_value "GIPHY_API_KEY")"
    freesound_api_key="$(resolve_installer_env_value "FREESOUND_API_KEY")"
    pixabay_api_key="$(resolve_installer_env_value "PIXABAY_API_KEY")"
    hf_token="$(resolve_installer_env_value "HF_TOKEN")"
    replicate_api_token="$(resolve_installer_env_value "REPLICATE_API_TOKEN")"

    if [ -t 0 ]; then
        echo
        echo "Skill API keys (shell env overrides openclaw.json env; repo .env is used only as a fallback default):"
        buffer_api_key="$(prompt_secret_value "BUFFER_API_KEY (post-scheduler)" "${buffer_api_key}")"
        giphy_api_key="$(prompt_secret_value "GIPHY_API_KEY (giphy search)" "${giphy_api_key}")"
        freesound_api_key="$(prompt_secret_value "FREESOUND_API_KEY (freesound search)" "${freesound_api_key}")"
        pixabay_api_key="$(prompt_secret_value "PIXABAY_API_KEY (pixabay search)" "${pixabay_api_key}")"
        hf_token="$(prompt_secret_value "HF_TOKEN (huggingface inference, optional)" "${hf_token}")"
        replicate_api_token="$(prompt_secret_value "REPLICATE_API_TOKEN (replicate inference, optional)" "${replicate_api_token}")"
    fi

    INSTALL_BUFFER_API_KEY="${buffer_api_key}"
    INSTALL_GIPHY_API_KEY="${giphy_api_key}"
    INSTALL_FREESOUND_API_KEY="${freesound_api_key}"
    INSTALL_PIXABAY_API_KEY="${pixabay_api_key}"
    INSTALL_HF_TOKEN="${hf_token}"
    INSTALL_REPLICATE_API_TOKEN="${replicate_api_token}"
}

configure_post_scheduler_env() {
    local configure_choice="${ABRA_CONFIGURE_POST_SCHEDULER_ENV:-}"
    local should_configure=1

    case "${configure_choice}" in
        1|true|TRUE|yes|YES)
            should_configure=0
            ;;
        0|false|FALSE|no|NO)
            should_configure=1
            ;;
        *)
            if [ -t 0 ]; then
                echo
                read -r -p "Configure optional Backblaze B2 env vars for post-scheduler now? [y/N] " reply
                case "${reply}" in
                    y|Y|yes|YES)
                        should_configure=0
                        ;;
                    *)
                        should_configure=1
                        ;;
                esac
            fi
            ;;
    esac

    if [ "${should_configure}" -ne 0 ]; then
        echo "  • Skipping optional post-scheduler Backblaze B2 env setup"
        return 0
    fi

    mkdir -p "$(dirname "${POST_SCHEDULER_ENV_FILE}")"

    local existing_key_id existing_app_key existing_bucket_id existing_bucket_name
    existing_key_id="$(read_env_value "${POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_KEY_ID")"
    existing_app_key="$(read_env_value "${POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_APPLICATION_KEY")"
    existing_bucket_id="$(read_env_value "${POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_BUCKET_ID")"
    existing_bucket_name="$(read_env_value "${POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_BUCKET_NAME")"

    if [ -z "${existing_key_id}" ]; then
        existing_key_id="$(read_env_value "${LEGACY_POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_KEY_ID")"
    fi
    if [ -z "${existing_app_key}" ]; then
        existing_app_key="$(read_env_value "${LEGACY_POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_APPLICATION_KEY")"
    fi
    if [ -z "${existing_bucket_id}" ]; then
        existing_bucket_id="$(read_env_value "${LEGACY_POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_BUCKET_ID")"
    fi
    if [ -z "${existing_bucket_name}" ]; then
        existing_bucket_name="$(read_env_value "${LEGACY_POST_SCHEDULER_ENV_FILE}" "BACKBLAZE_B2_BUCKET_NAME")"
    fi

    local b2_key_id="${BACKBLAZE_B2_KEY_ID:-${existing_key_id}}"
    local b2_app_key="${BACKBLAZE_B2_APPLICATION_KEY:-${existing_app_key}}"
    local b2_bucket_id="${BACKBLAZE_B2_BUCKET_ID:-${existing_bucket_id}}"
    local b2_bucket_name="${BACKBLAZE_B2_BUCKET_NAME:-${existing_bucket_name}}"

    if [ -t 0 ]; then
        echo
        echo "Optional Backblaze B2 settings for post-scheduler:"
        echo "  File: ${POST_SCHEDULER_ENV_FILE}"

        read -r -p "BACKBLAZE_B2_KEY_ID [${b2_key_id}]: " reply
        b2_key_id="${reply:-${b2_key_id}}"
        read -r -p "BACKBLAZE_B2_APPLICATION_KEY [${b2_app_key}]: " reply
        b2_app_key="${reply:-${b2_app_key}}"
        read -r -p "BACKBLAZE_B2_BUCKET_ID [${b2_bucket_id}]: " reply
        b2_bucket_id="${reply:-${b2_bucket_id}}"
        read -r -p "BACKBLAZE_B2_BUCKET_NAME [${b2_bucket_name}]: " reply
        b2_bucket_name="${reply:-${b2_bucket_name}}"
    fi

    cat > "${POST_SCHEDULER_ENV_FILE}" <<EOF
# Optional Backblaze B2 settings for the post-scheduler skill.
# Stored next to openclaw.json and referenced via env.BACKBLAZE_B2_ENV_FILE.
# BUFFER_API_KEY is stored separately in openclaw.json env.
BACKBLAZE_B2_KEY_ID="$(escape_env_value "${b2_key_id}")"
BACKBLAZE_B2_APPLICATION_KEY="$(escape_env_value "${b2_app_key}")"
BACKBLAZE_B2_BUCKET_ID="$(escape_env_value "${b2_bucket_id}")"
BACKBLAZE_B2_BUCKET_NAME="$(escape_env_value "${b2_bucket_name}")"
EOF

    rm -f "${LEGACY_POST_SCHEDULER_ENV_FILE}"

    echo "  ✓ post-scheduler Backblaze B2 env file: ${POST_SCHEDULER_ENV_FILE}"
    echo "    Legacy workspace fallback removed: ${LEGACY_POST_SCHEDULER_ENV_FILE}"
    echo "    openclaw.json env.BACKBLAZE_B2_ENV_FILE -> ${POST_SCHEDULER_ENV_FILE_CONTAINER}"
}

echo "Installing Abra - Agent de Branding..."
echo

command -v jq >/dev/null 2>&1 || { echo "jq required: brew install jq"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 required to scaffold post-scheduler env values"; exit 1; }

mkdir -p "${AGENT_WORKSPACE_HOST}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REPO_ROOT=""
if command -v git >/dev/null 2>&1; then
    REPO_ROOT="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [ -z "${REPO_ROOT}" ]; then
    REPO_ROOT="${SCRIPT_DIR}"
fi

ROOT_ENV_FILE="${REPO_ROOT}/.env"
SOURCE_ROOT=""
OPENCLAW_OWNER="$(resolve_openclaw_owner)"

if [ -n "${OPENCLAW_OWNER}" ]; then
    normalize_openclaw_ownership "${OPENCLAW_OWNER}"
fi

if [ -n "$(git -C "${REPO_ROOT}" rev-parse --show-toplevel 2>/dev/null || true)" ] && [ -d "${REPO_ROOT}/skills" ]; then
    SOURCE_ROOT="${REPO_ROOT}"
else
    TEMP_CLONE=$(mktemp -d)
    git clone --depth 1 -b "${REPO_BRANCH}" "${REPO_URL}" "${TEMP_CLONE}"
    SOURCE_ROOT="${TEMP_CLONE}"
fi

cp "${SOURCE_ROOT}/AGENTS.md"   "${AGENT_WORKSPACE_HOST}/AGENTS.md"
cp "${SOURCE_ROOT}/SOUL.md"     "${AGENT_WORKSPACE_HOST}/SOUL.md"
cp "${SOURCE_ROOT}/WORKFLOW.md" "${AGENT_WORKSPACE_HOST}/WORKFLOW.md"
echo "  ✓ AGENTS.md"
echo "  ✓ SOUL.md"
echo "  ✓ WORKFLOW.md"

WORKFLOWS_DEST="${AGENT_WORKSPACE_HOST}/workflows"
mkdir -p "${WORKFLOWS_DEST}"
rm -rf "${WORKFLOWS_DEST}"/*
cp -r "${SOURCE_ROOT}/workflows"/* "${WORKFLOWS_DEST}/"
echo "  ✓ workflows"

SKILL_SOURCE="${SOURCE_ROOT}/skills"

mkdir -p "${SKILLS_DEST}"
for skill_dir in "${SKILL_SOURCE}"/*; do
    [ -d "${skill_dir}" ] || continue
    skill_name=$(basename "${skill_dir}")
    [[ "${skill_name}" == "input" || "${skill_name}" == "output" || "${skill_name}" == ".venv" ]] && continue
    copy_directory_clean "${skill_dir}" "${SKILLS_DEST}/${skill_name}"
    echo "  + ${skill_name}"
done
[ -n "${TEMP_CLONE}" ] && rm -rf "${TEMP_CLONE}"

configure_post_scheduler_env
configure_skill_api_keys

cp "${CONFIG_FILE}" "${CONFIG_FILE}.backup.$(date +%Y%m%d%H%M%S)"

jq '.agents //= {"list": []}' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
jq '.env //= {}' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

# Upsert agent entry: update workspace if id already exists, add if not.
# This is safe on re-runs and avoids the stale-entry problem caused by calling
# 'openclaw agents add' (which writes an entry without --workspace) before this block.
jq --arg id "${AGENT_NAME}" \
   --arg name "${AGENT_DISPLAY_NAME}" \
   --arg ws "${AGENT_WORKSPACE_CONTAINER}" \
   'if (.agents.list | map(.id) | index($id)) != null
    then .agents.list |= map(if .id == $id then .workspace = $ws else . end)
    else .agents.list += [{id: $id, name: $name, workspace: $ws}]
    end' \
   "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

# Add a telegram binding only if one doesn't already exist for this agent.
# Set TELEGRAM_PEER_ID to scope the binding to a specific group (recommended).
# Without it the binding matches all traffic on the default telegram account.
if ! jq -e ".bindings[]? | select(.agentId == \"${AGENT_NAME}\")" "${CONFIG_FILE}" >/dev/null 2>&1; then
    jq '.bindings //= []' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

    BINDING_JSON=$(jq -n --arg a "${AGENT_NAME}" \
        '{agentId: $a, match: {channel: "telegram"}}')
    echo "  ✓ Telegram binding (channel-wide; scoped via allowFrom in openclaw.json)"

    jq ".bindings += [${BINDING_JSON}]" "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
fi

jq --arg path "${POST_SCHEDULER_ENV_FILE_CONTAINER}" '.env.BACKBLAZE_B2_ENV_FILE = $path' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
set_config_env_value "BUFFER_API_KEY" "${INSTALL_BUFFER_API_KEY}"
set_config_env_value "GIPHY_API_KEY" "${INSTALL_GIPHY_API_KEY}"
set_config_env_value "FREESOUND_API_KEY" "${INSTALL_FREESOUND_API_KEY}"
set_config_env_value "PIXABAY_API_KEY" "${INSTALL_PIXABAY_API_KEY}"
set_config_env_value "HF_TOKEN" "${INSTALL_HF_TOKEN}"
set_config_env_value "REPLICATE_API_TOKEN" "${INSTALL_REPLICATE_API_TOKEN}"

openclaw gateway restart || true

echo
echo "Done! Agent '${AGENT_DISPLAY_NAME}' installed."
echo "Workspace: ${AGENT_WORKSPACE_HOST}"
echo "Workflows: ${WORKFLOWS_DEST}"
echo "Skills: ${SKILLS_DEST}"
echo "Post-scheduler Backblaze env: ${POST_SCHEDULER_ENV_FILE}"
echo
echo "To customize, edit: ${CONFIG_FILE}"
echo "Skill API keys are persisted in openclaw.json env when provided during install."
echo "Configured env pointer: env.BACKBLAZE_B2_ENV_FILE=${POST_SCHEDULER_ENV_FILE_CONTAINER}"
echo "Restart gateway: openclaw gateway restart"
