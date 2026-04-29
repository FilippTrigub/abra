#!/bin/bash
set -e

AGENT_NAME="abra"
AGENT_DISPLAY_NAME="Abra"
HOST_OPENCLAW_DIR="${HOME}/.openclaw"
CONTAINER_OPENCLAW_DIR="/home/node/.openclaw"
AGENT_WORKSPACE_HOST="${HOST_OPENCLAW_DIR}/workspace-${AGENT_NAME}"
CONFIG_FILE="${HOST_OPENCLAW_DIR}/openclaw.json"
POST_SCHEDULER_ENV_FILE="${HOST_OPENCLAW_DIR}/post-scheduler-backblaze.env"
POST_SCHEDULER_ENV_FILE_CONTAINER="${CONTAINER_OPENCLAW_DIR}/post-scheduler-backblaze.env"
BACKBLAZE_B2_RUNPOD_ENV_FILE="${HOST_OPENCLAW_DIR}/runpod-backblaze.env"
BACKBLAZE_B2_RUNPOD_ENV_FILE_CONTAINER="${CONTAINER_OPENCLAW_DIR}/runpod-backblaze.env"
LEGACY_POST_SCHEDULER_ENV_FILE="${AGENT_WORKSPACE_HOST}/skills/post-scheduler/.env"

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

echo "Uninstalling ${AGENT_DISPLAY_NAME} from OpenClaw..."
echo

command -v jq >/dev/null 2>&1 || { echo "jq required: brew install jq"; exit 1; }

OPENCLAW_OWNER="$(resolve_openclaw_owner)"
if [ -n "${OPENCLAW_OWNER}" ]; then
    normalize_openclaw_ownership "${OPENCLAW_OWNER}"
fi

if [ -f "${CONFIG_FILE}" ]; then
    cp "${CONFIG_FILE}" "${CONFIG_FILE}.backup.$(date +%Y%m%d%H%M%S)"

    jq --arg id "${AGENT_NAME}" '
        if .agents and .agents.list then
            .agents.list |= map(select(.id != $id))
        else
            .
        end
    ' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
    echo "  ✓ Removed agent entry from openclaw.json"

    jq --arg id "${AGENT_NAME}" '
        if .bindings then
            .bindings |= map(select(.agentId != $id))
        else
            .
        end
    ' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
    echo "  ✓ Removed Abra bindings from openclaw.json"

    jq --arg path "${POST_SCHEDULER_ENV_FILE_CONTAINER}" '
        if .env.BACKBLAZE_B2_ENV_FILE? == $path then
            del(.env.BACKBLAZE_B2_ENV_FILE)
        else
            .
        end
    ' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

    jq --arg path "${BACKBLAZE_B2_RUNPOD_ENV_FILE_CONTAINER}" '
        if .env.BACKBLAZE_B2_RUNPOD_ENV_FILE? == $path then
            del(.env.BACKBLAZE_B2_RUNPOD_ENV_FILE)
        else
            .
        end
    ' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
    echo "  ✓ Removed Abra-managed env file pointers when they matched default Abra paths"
else
    echo "  • openclaw.json not found; skipping config cleanup"
fi

rm -rf "${AGENT_WORKSPACE_HOST}"
echo "  ✓ Removed workspace: ${AGENT_WORKSPACE_HOST}"

rm -f "${POST_SCHEDULER_ENV_FILE}" "${BACKBLAZE_B2_RUNPOD_ENV_FILE}" "${LEGACY_POST_SCHEDULER_ENV_FILE}"
echo "  ✓ Removed Abra-managed sidecar env files"

openclaw gateway restart || true

echo
echo "Done! ${AGENT_DISPLAY_NAME} was removed from OpenClaw."
echo "Left shared API keys in openclaw.json untouched for safety."
