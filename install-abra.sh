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

escape_env_value() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '%s' "${value}"
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
# BUFFER_API_KEY still belongs in the normal shell/container environment.
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
REPO_ROOT="${SCRIPT_DIR}"

cp "${REPO_ROOT}/AGENTS.md"   "${AGENT_WORKSPACE_HOST}/AGENTS.md"
cp "${REPO_ROOT}/SOUL.md"     "${AGENT_WORKSPACE_HOST}/SOUL.md"
cp "${REPO_ROOT}/WORKFLOW.md" "${AGENT_WORKSPACE_HOST}/WORKFLOW.md"
echo "  ✓ AGENTS.md"
echo "  ✓ SOUL.md"
echo "  ✓ WORKFLOW.md"

WORKFLOWS_DEST="${AGENT_WORKSPACE_HOST}/workflows"
mkdir -p "${WORKFLOWS_DEST}"
rm -rf "${WORKFLOWS_DEST}"/*
cp -r "${REPO_ROOT}/workflows"/* "${WORKFLOWS_DEST}/"
echo "  ✓ workflows"

SKILL_SOURCE="${REPO_ROOT}/skills"

if [ ! -d "${SKILL_SOURCE}" ]; then
    TEMP_CLONE=$(mktemp -d)
    git clone --depth 1 -b "${REPO_BRANCH}" "${REPO_URL}" "${TEMP_CLONE}"
    SKILL_SOURCE="${TEMP_CLONE}/skills"
fi

mkdir -p "${SKILLS_DEST}"
for skill_dir in "${SKILL_SOURCE}"/*; do
    [ -d "${skill_dir}" ] || continue
    skill_name=$(basename "${skill_dir}")
    [[ "${skill_name}" == "input" || "${skill_name}" == "output" || "${skill_name}" == ".venv" ]] && continue
    rm -rf "${SKILLS_DEST}/${skill_name}"
    cp -r "${skill_dir}" "${SKILLS_DEST}/${skill_name}"
    echo "  + ${skill_name}"
done
[ -n "${TEMP_CLONE}" ] && rm -rf "${TEMP_CLONE}"

configure_post_scheduler_env

CONFIG_FILE="${HOST_OPENCLAW_DIR}/openclaw.json"
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

openclaw gateway restart || true

echo
echo "Done! Agent '${AGENT_DISPLAY_NAME}' installed."
echo "Workspace: ${AGENT_WORKSPACE_HOST}"
echo "Workflows: ${WORKFLOWS_DEST}"
echo "Skills: ${SKILLS_DEST}"
echo "Post-scheduler Backblaze env: ${POST_SCHEDULER_ENV_FILE}"
echo
echo "To customize, edit: ${CONFIG_FILE}"
echo "Reminder: BUFFER_API_KEY must still be provided in the shell/container environment."
echo "Configured env pointer: env.BACKBLAZE_B2_ENV_FILE=${POST_SCHEDULER_ENV_FILE_CONTAINER}"
echo "Restart gateway: openclaw gateway restart"
