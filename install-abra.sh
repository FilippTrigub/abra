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

echo "Installing Abra - Agent de Branding..."
echo

command -v jq >/dev/null 2>&1 || { echo "jq required: brew install jq"; exit 1; }

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

CONFIG_FILE="${HOST_OPENCLAW_DIR}/openclaw.json"
cp "${CONFIG_FILE}" "${CONFIG_FILE}.backup.$(date +%Y%m%d%H%M%S)"

jq '.agents //= {"list": []}' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

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

openclaw gateway restart || true

echo
echo "Done! Agent '${AGENT_DISPLAY_NAME}' installed."
echo "Workspace: ${AGENT_WORKSPACE_HOST}"
echo "Workflows: ${WORKFLOWS_DEST}"
echo "Skills: ${SKILLS_DEST}"
echo
echo "To customize, edit: ${CONFIG_FILE}"
echo "Restart gateway: openclaw gateway restart"
