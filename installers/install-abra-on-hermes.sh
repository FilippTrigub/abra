#!/bin/bash
# NOTE (container path): HERMES_PROFILE_CONTAINER is hardcoded to
# /opt/data/profiles/<profile>. This assumes hermes runs inside a Docker
# container as the 'hermes' user, with the host ~/.hermes directory
# volume-mounted at /opt/data. For native (non-containerised) installs,
# HERMES_HOME stays at ~/.hermes and profiles live under ~/.hermes/profiles/.
set -e

PROFILE_NAME="${PROFILE_NAME:-abra}"
REPO_URL="${REPO_URL:-https://github.com/FilippTrigub/abra.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
HERMES_INSTALL_GATEWAY="${HERMES_INSTALL_GATEWAY:-1}"
HERMES_ENV_COPY_KEYS="${ABRA_COPY_HERMES_ENV_VARS:-}"

# When run via sudo, $HOME is /root — resolve the real user's home instead.
if [ -n "${SUDO_USER:-}" ]; then
    REAL_HOME="$(getent passwd "${SUDO_USER}" | cut -d: -f6)"
else
    REAL_HOME="${HOME}"
fi
HOST_HERMES_ROOT="${REAL_HOME}/.hermes"
HOST_OPENCLAW_ROOT="${REAL_HOME}/.openclaw"
CONTAINER_HERMES_ROOT="/opt/data"
HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"
CONTAINER_PROFILE_DIR="${CONTAINER_HERMES_ROOT}/profiles/${PROFILE_NAME}"
ENV_FILE_OVERRIDE=""

usage() {
    cat <<EOF
Usage: $0 [--env-file PATH] [--profile NAME]

Options:
  -e, --env-file PATH   Use PATH as the source .env file for installer env values
  -p, --profile NAME    Hermes profile name (default: abra)
      --no-gateway       Do not run 'hermes -p PROFILE gateway install'
  -h, --help            Show this help message

Environment:
  ABRA_COPY_HERMES_ENV_VARS  Comma-separated keys, 'all', or 'none' for ~/.hermes/.env copying
                             TELEGRAM_BOT_TOKEN is always excluded; enter it when prompted
                             TELEGRAM_ALLOWED_USERS always comes from ~/.hermes/.env or ~/.openclaw/.env
  HERMES_INSTALL_GATEWAY     Set to 0 to skip gateway service installation
EOF
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -e|--env-file)
                if [ "$#" -lt 2 ]; then
                    echo "Error: $1 requires a path" >&2
                    usage >&2
                    exit 1
                fi
                ENV_FILE_OVERRIDE="$2"
                shift 2
                ;;
            --env-file=*)
                ENV_FILE_OVERRIDE="${1#*=}"
                shift
                ;;
            -p|--profile)
                if [ "$#" -lt 2 ]; then
                    echo "Error: $1 requires a name" >&2
                    usage >&2
                    exit 1
                fi
                PROFILE_NAME="$2"
                HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"
                CONTAINER_PROFILE_DIR="${CONTAINER_HERMES_ROOT}/profiles/${PROFILE_NAME}"
                shift 2
                ;;
            --profile=*)
                PROFILE_NAME="${1#*=}"
                HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"
                CONTAINER_PROFILE_DIR="${CONTAINER_HERMES_ROOT}/profiles/${PROFILE_NAME}"
                shift
                ;;
            --no-gateway)
                HERMES_INSTALL_GATEWAY=0
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo "Error: unknown argument: $1" >&2
                usage >&2
                exit 1
                ;;
        esac
    done
}

resolve_path() {
    local path="$1"
    [ -n "${path}" ] || return 0

    python3 - "$path" <<'PY'
from pathlib import Path
import sys

print(Path(sys.argv[1]).expanduser().resolve(strict=False))
PY
}

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

list_env_keys() {
    local file="$1"
    [ -f "${file}" ] || return 0

    python3 - "$file" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
seen: set[str] = set()
for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key = line.split("=", 1)[0].strip()
    if key == "TELEGRAM_BOT_TOKEN":
        continue
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) and key not in seen:
        seen.add(key)
        print(key)
PY
}

normalize_comma_list() {
    local value="$1"
    python3 - "$value" <<'PY'
import sys

parts = [part.strip() for part in sys.argv[1].split(",")]
print(",".join(part for part in parts if part))
PY
}

hermes_env_key_selected() {
    local key="$1"
    case ",${HERMES_ENV_COPY_KEYS}," in
        *,"${key}",*) return 0 ;;
        *) return 1 ;;
    esac
}

select_hermes_env_copy_keys() {
    local hermes_env="${HOST_HERMES_ROOT}/.env"
    [ -f "${hermes_env}" ] || return 0

    local keys=()
    local key
    while IFS= read -r key; do
        [ -n "${key}" ] && keys+=("${key}")
    done < <(list_env_keys "${hermes_env}")
    [ "${#keys[@]}" -gt 0 ] || return 0

    if [ "${HERMES_ENV_COPY_KEYS}" = "all" ]; then
        HERMES_ENV_COPY_KEYS="$(IFS=,; printf '%s' "${keys[*]}")"
        echo "  ✓ selected all ${#keys[@]} vars from ${hermes_env}"
        return 0
    fi

    if [ "${HERMES_ENV_COPY_KEYS}" = "none" ]; then
        HERMES_ENV_COPY_KEYS=""
        echo "  ✓ selected no vars from ${hermes_env}"
        return 0
    fi

    if [ -n "${HERMES_ENV_COPY_KEYS}" ]; then
        HERMES_ENV_COPY_KEYS="$(normalize_comma_list "${HERMES_ENV_COPY_KEYS}")"
        echo "  ✓ selected vars from ${hermes_env}: ${HERMES_ENV_COPY_KEYS}"
        return 0
    fi

    if [ ! -t 0 ]; then
        HERMES_ENV_COPY_KEYS=""
        echo "  ✓ non-interactive: selected no vars from ${hermes_env}"
        return 0
    fi

    echo
    echo "${hermes_env} exists. Select default-profile env vars to copy into profile '${PROFILE_NAME}'."
    echo "Leave empty to copy none, enter 'all', or use comma-separated numbers/names."
    echo

    local i=1
    for key in "${keys[@]}"; do
        printf '  %2d) %s\n' "${i}" "${key}"
        i=$((i + 1))
    done

    local reply=""
    read -r -p "Copy vars from ${hermes_env}? [none]: " reply
    reply="$(normalize_comma_list "${reply}")"

    if [ -z "${reply}" ] || [ "${reply}" = "none" ]; then
        HERMES_ENV_COPY_KEYS=""
        echo "  ✓ selected no vars from ${hermes_env}"
        return 0
    fi

    if [ "${reply}" = "all" ]; then
        HERMES_ENV_COPY_KEYS="$(IFS=,; printf '%s' "${keys[*]}")"
        echo "  ✓ selected all ${#keys[@]} vars from ${hermes_env}"
        return 0
    fi

    local selected=()
    local token
    IFS=',' read -ra requested <<< "${reply}"
    for token in "${requested[@]}"; do
        token="$(printf '%s' "${token}" | xargs)"
        [ -n "${token}" ] || continue
        if [[ "${token}" =~ ^[0-9]+$ ]] && [ "${token}" -ge 1 ] && [ "${token}" -le "${#keys[@]}" ]; then
            selected+=("${keys[$((token - 1))]}")
        else
            selected+=("${token}")
        fi
    done

    HERMES_ENV_COPY_KEYS="$(IFS=,; printf '%s' "${selected[*]}")"
    echo "  ✓ selected vars from ${hermes_env}: ${HERMES_ENV_COPY_KEYS:-none}"
}

escape_env_value() {
    local value="$1"
    value="${value//$'\r'/}"
    value="${value//$'\n'/}"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '%s' "${value}"
}

append_selected_hermes_env_values() {
    local dest="$1"
    local hermes_env="${HOST_HERMES_ROOT}/.env"
    [ -f "${hermes_env}" ] || return 0
    [ -n "${HERMES_ENV_COPY_KEYS}" ] || return 0

    python3 - "$hermes_env" "$dest" "$HERMES_ENV_COPY_KEYS" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
dest = Path(sys.argv[2])
selected = [key.strip() for key in sys.argv[3].split(",") if key.strip()]

def parse_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        key = key.strip()
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key] = value
    return values

existing = set(parse_dotenv(dest))
source_values = parse_dotenv(source)
forbidden = {"TELEGRAM_BOT_TOKEN"}
extras = [(key, source_values[key]) for key in selected if key not in forbidden and key in source_values and key not in existing]
if not extras:
    raise SystemExit(0)

def quote(value: str) -> str:
    value = value.replace("\r", "").replace("\n", "")
    value = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{value}"'

with dest.open("a", encoding="utf-8") as handle:
    handle.write("\n# =============================================================================\n")
    handle.write("# SELECTED DEFAULT PROFILE VARIABLES\n")
    handle.write("# =============================================================================\n")
    for key, value in extras:
        handle.write(f"{key}={quote(value)}\n")
PY
}

ensure_hermes_profile() {
    if ! command -v hermes >/dev/null 2>&1; then
        echo "Error: hermes CLI is required to create the '${PROFILE_NAME}' profile." >&2
        echo "Install Hermes first, or run inside an environment where 'hermes' is on PATH." >&2
        exit 1
    fi

    if hermes profile show "${PROFILE_NAME}" >/dev/null 2>&1; then
        if hermes profile alias "${PROFILE_NAME}" >/dev/null 2>&1; then
            echo "  ✓ Hermes alias '${PROFILE_NAME}' installed"
        fi
        echo "  ✓ Hermes profile '${PROFILE_NAME}' already exists"
        return 0
    fi

    if [ -d "${HOST_PROFILE_DIR}" ]; then
        if hermes profile alias "${PROFILE_NAME}" >/dev/null 2>&1; then
            echo "  ✓ Hermes alias '${PROFILE_NAME}' installed"
        fi
        echo "  ✓ Hermes profile directory already exists: ${HOST_PROFILE_DIR}"
        return 0
    fi

    hermes profile create "${PROFILE_NAME}" --clone --description "Abra content capture and brand-management agent."
    echo "  ✓ Hermes profile created with 'hermes profile create ${PROFILE_NAME} --clone'"
}

copy_default_auth_json() {
    local source_auth="${HOST_HERMES_ROOT}/auth.json"
    local dest_auth="${HOST_PROFILE_DIR}/auth.json"

    if [ -f "${source_auth}" ]; then
        cp "${source_auth}" "${dest_auth}"
        chmod 600 "${dest_auth}" 2>/dev/null || true
        echo "  ✓ auth.json (copied from ${source_auth})"
    else
        echo "  ! auth.json not found at ${source_auth}; run 'hermes setup --portal' if this profile needs Portal auth"
    fi
}

install_hermes_gateway() {
    if [ "${HERMES_INSTALL_GATEWAY}" = "0" ]; then
        echo "  ✓ gateway install skipped"
        return 0
    fi

    hermes -p "${PROFILE_NAME}" gateway install
    echo "  ✓ gateway installed with 'hermes -p ${PROFILE_NAME} gateway install'"
}

resolve_installer_env_value() {
    local key="$1"
    local value="${!key:-}"

    # 1. Shell environment
    if [ -n "${value}" ]; then
        printf '%s' "${value}"
        return 0
    fi

    # 2. Claw-parade .env (skill API keys)
    if [ -n "${ROOT_ENV_FILE:-}" ] && [ -f "${ROOT_ENV_FILE}" ]; then
        value="$(read_env_value "${ROOT_ENV_FILE}" "${key}")"
        if [ -n "${value}" ]; then
            printf '%s' "${value}"
            return 0
        fi
    fi

    # 3. ~/.hermes/.env (only keys explicitly selected for this profile)
    local hermes_env="${HOST_HERMES_ROOT}/.env"
    if [ "${key}" != "TELEGRAM_BOT_TOKEN" ] && [ -f "${hermes_env}" ] && hermes_env_key_selected "${key}"; then
        value="$(read_env_value "${hermes_env}" "${key}")"
        if [ -n "${value}" ]; then
            printf '%s' "${value}"
            return 0
        fi
    fi

    printf '%s' "${value}"
}

resolve_telegram_bot_token() {
    local value="${TELEGRAM_BOT_TOKEN:-}"

    # Telegram bot tokens are profile-specific. Allow shell env and this repo's
    # installer .env, but never inherit them from ~/.hermes/.env or OpenClaw.
    if [ -z "${value}" ] && [ -n "${ROOT_ENV_FILE:-}" ] && [ -f "${ROOT_ENV_FILE}" ]; then
        value="$(read_env_value "${ROOT_ENV_FILE}" "TELEGRAM_BOT_TOKEN")"
    fi

    if [ -z "${value}" ] && [ -t 0 ]; then
        echo
        read -r -p "Telegram bot token for Hermes profile '${PROFILE_NAME}' (leave empty to skip): " value
        echo
    fi

    printf '%s' "${value}"
}

resolve_telegram_allowed_users() {
    local value=""
    local hermes_env="${HOST_HERMES_ROOT}/.env"
    local openclaw_env="${HOST_OPENCLAW_ROOT}/.env"

    # Allowed-user lists protect the gateway and should follow the user's
    # existing platform allowlist, independent of the optional ~/.hermes/.env
    # variable picker.
    if [ -f "${hermes_env}" ]; then
        value="$(read_env_value "${hermes_env}" "TELEGRAM_ALLOWED_USERS")"
    fi

    if [ -z "${value}" ] && [ -f "${openclaw_env}" ]; then
        value="$(read_env_value "${openclaw_env}" "TELEGRAM_ALLOWED_USERS")"
    fi

    printf '%s' "${value}"
}

skill_to_env_keys() {
    local skill="$1"
    case "${skill}" in
        post-scheduler) printf '%s\n' "BUFFER_API_KEY" ;;
        giphy) printf '%s\n' "GIPHY_API_KEY" ;;
        freesound) printf '%s\n' "FREESOUND_API_KEY" ;;
        pixabay) printf '%s\n' "PIXABAY_API_KEY" ;;
        email-campaigner) printf '%s\n' "RESEND_API_KEY" "MAILCHIMP_API_KEY" "MAILCHIMP_SERVER_PREFIX" "SENDGRID_API_KEY" "KIT_API_KEY" "KIT_API_SECRET" "DUB_API_KEY" ;;
        seo-researcher) printf '%s\n' "GSC_CLIENT_ID" "GSC_CLIENT_SECRET" "GSC_REFRESH_TOKEN" "SEMRUSH_API_KEY" "AHREFS_API_KEY" "DATAFORSEO_LOGIN" "DATAFORSEO_PASSWORD" "KEYWORDS_EVERYWHERE_API_KEY" "PLAUSIBLE_API_KEY" "PLAUSIBLE_SITE_ID" ;;
        ads-manager) printf '%s\n' "GA4_CLIENT_ID" "GA4_CLIENT_SECRET" "GA4_REFRESH_TOKEN" "GA4_PROPERTY_ID" "GOOGLE_ADS_CLIENT_ID" "GOOGLE_ADS_CLIENT_SECRET" "GOOGLE_ADS_REFRESH_TOKEN" "GOOGLE_ADS_DEVELOPER_TOKEN" "GOOGLE_ADS_CUSTOMER_ID" "GOOGLE_ADS_LOGIN_CUSTOMER_ID" ;;
        funnel-optimizer) printf '%s\n' "GA4_CLIENT_ID" "GA4_CLIENT_SECRET" "GA4_REFRESH_TOKEN" "GA4_PROPERTY_ID" "MIXPANEL_SA_USERNAME" "MIXPANEL_SECRET" "AMPLITUDE_API_KEY" "AMPLITUDE_SECRET_KEY" "HOTJAR_SITE_ID" "HOTJAR_API_TOKEN" "OPTIMIZELY_SDK_KEY" "OPTIMIZELY_ACCESS_TOKEN" "POSTHOG_PROJECT_ID" "POSTHOG_API_KEY" "POSTHOG_PROJECT_API_KEY" "POSTHOG_HOST" "POSTHOG_APP_HOST" "POSTHOG_INGEST_HOST" ;;
        revenue-manager) printf '%s\n' "HUBSPOT_ACCESS_TOKEN" "SALESFORCE_CLIENT_ID" "SALESFORCE_CLIENT_SECRET" "SALESFORCE_USERNAME" "SALESFORCE_PASSWORD" "SALESFORCE_SECURITY_TOKEN" "CLOSE_API_KEY" "OUTREACH_CLIENT_ID" "OUTREACH_CLIENT_SECRET" "OUTREACH_REFRESH_TOKEN" "CROSSBEAM_API_KEY" "APOLLO_API_KEY" "CLEARBIT_API_KEY" "ZOOMINFO_USERNAME" "ZOOMINFO_PASSWORD" "CLAY_API_KEY" "SEGMENT_WRITE_KEY" ;;
        runpod-gpu) printf '%s\n' "RUNPOD_API_KEY" "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR" "RUNPOD_ENDPOINT_ID_VIDEO_MATTE" "RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR" "RUNPOD_ENDPOINT_ID_BOKEH_EFFECT" "RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER" "RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER" "RUNPOD_ENDPOINT_ID_PHOTO_PICKER" ;;
        ml-models) printf '%s\n' "HF_TOKEN" "REPLICATE_API_TOKEN" ;;
        animate-image) printf '%s\n' "FAL_API_KEY" ;;
    esac
}

skill_has_any_value() {
    local skill="$1"
    while IFS= read -r key; do
        [ -n "${key}" ] || continue
        local val
        val="$(resolve_installer_env_value "${key}")"
        [ -n "${val}" ] && return 0
    done < <(skill_to_env_keys "${skill}")
    return 1
}

select_enabled_skills() {
    local env_val="${ABRA_ENABLE_SKILLS:-}"
    local reply=""

    # Initialize all skills to disabled
    SKILL_ENABLED_POST_SCHEDULER=0
    SKILL_ENABLED_GIPHY=0
    SKILL_ENABLED_FREESOUND=0
    SKILL_ENABLED_PIXABAY=0
    SKILL_ENABLED_EMAIL_CAMPAIGNER=0
    SKILL_ENABLED_SEO_RESEARCHER=0
    SKILL_ENABLED_ADS_MANAGER=0
    SKILL_ENABLED_FUNNEL_OPTIMIZER=0
    SKILL_ENABLED_REVENUE_MANAGER=0
    SKILL_ENABLED_RUNPOD_GPU=0
    SKILL_ENABLED_ML_MODELS=0
    SKILL_ENABLED_ANIMATE_IMAGE=0
    PROVIDER_ENABLED_POSTHOG=0

    # Non-interactive: ABRA_ENABLE_SKILLS=all
    if [ "${env_val}" = "all" ]; then
        SKILL_ENABLED_POST_SCHEDULER=1
        SKILL_ENABLED_GIPHY=1
        SKILL_ENABLED_FREESOUND=1
        SKILL_ENABLED_PIXABAY=1
        SKILL_ENABLED_EMAIL_CAMPAIGNER=1
        SKILL_ENABLED_SEO_RESEARCHER=1
        SKILL_ENABLED_ADS_MANAGER=1
        SKILL_ENABLED_FUNNEL_OPTIMIZER=1
        SKILL_ENABLED_REVENUE_MANAGER=1
        SKILL_ENABLED_RUNPOD_GPU=1
        SKILL_ENABLED_ML_MODELS=1
        SKILL_ENABLED_ANIMATE_IMAGE=1
        PROVIDER_ENABLED_POSTHOG=1
        return 0
    fi

    # Non-interactive: ABRA_ENABLE_SKILLS=post-scheduler,giphy,...
    if [ -n "${env_val}" ]; then
        local skill
        IFS=',' read -ra skills_list <<< "${env_val}"
        for skill in "${skills_list[@]}"; do
            skill="$(printf '%s' "${skill}" | xargs)"
            case "${skill}" in
                post-scheduler) SKILL_ENABLED_POST_SCHEDULER=1 ;;
                giphy) SKILL_ENABLED_GIPHY=1 ;;
                freesound) SKILL_ENABLED_FREESOUND=1 ;;
                pixabay) SKILL_ENABLED_PIXABAY=1 ;;
                email-campaigner) SKILL_ENABLED_EMAIL_CAMPAIGNER=1 ;;
                seo-researcher) SKILL_ENABLED_SEO_RESEARCHER=1 ;;
                ads-manager) SKILL_ENABLED_ADS_MANAGER=1 ;;
                funnel-optimizer) SKILL_ENABLED_FUNNEL_OPTIMIZER=1; PROVIDER_ENABLED_POSTHOG=1 ;;
                revenue-manager) SKILL_ENABLED_REVENUE_MANAGER=1 ;;
                runpod-gpu) SKILL_ENABLED_RUNPOD_GPU=1 ;;
                ml-models) SKILL_ENABLED_ML_MODELS=1 ;;
                animate-image) SKILL_ENABLED_ANIMATE_IMAGE=1 ;;
            esac
        done
        return 0
    fi

    # Interactive mode: prompt user with defaults based on .env values
    if [ -t 0 ]; then
        echo
        echo "Select skills to configure (API keys required only for enabled skills):"
        echo

        local default
        default="N"; skill_has_any_value "post-scheduler" && default="y"
        read -r -p "Enable post-scheduler (Buffer scheduling)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_POST_SCHEDULER=1

        default="N"; skill_has_any_value "giphy" && default="y"
        read -r -p "Enable giphy (animated GIF stickers)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_GIPHY=1

        default="N"; skill_has_any_value "freesound" && default="y"
        read -r -p "Enable freesound (sound effects)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_FREESOUND=1

        default="N"; skill_has_any_value "pixabay" && default="y"
        read -r -p "Enable pixabay (royalty-free media)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_PIXABAY=1

        default="N"; skill_has_any_value "email-campaigner" && default="y"
        read -r -p "Enable email-campaigner (email marketing)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_EMAIL_CAMPAIGNER=1

        default="N"; skill_has_any_value "seo-researcher" && default="y"
        read -r -p "Enable seo-researcher (SEO research)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_SEO_RESEARCHER=1

        default="N"; skill_has_any_value "ads-manager" && default="y"
        read -r -p "Enable ads-manager (Google Ads)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_ADS_MANAGER=1

        default="N"; skill_has_any_value "funnel-optimizer" && default="y"
        read -r -p "Enable funnel-optimizer (analytics)? [${default}]: " reply
        if [ "${reply:-${default}}" = "y" ]; then
            SKILL_ENABLED_FUNNEL_OPTIMIZER=1
            PROVIDER_ENABLED_POSTHOG=1
        fi

        default="N"; skill_has_any_value "revenue-manager" && default="y"
        read -r -p "Enable revenue-manager (CRM operations)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_REVENUE_MANAGER=1

        default="N"; skill_has_any_value "runpod-gpu" && default="y"
        read -r -p "Enable runpod-gpu (GPU inference)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_RUNPOD_GPU=1

        default="N"; skill_has_any_value "ml-models" && default="y"
        read -r -p "Enable ml-models (HF/Replicate access)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_ML_MODELS=1

        default="N"; skill_has_any_value "animate-image" && default="y"
        read -r -p "Enable animate-image (fal.ai)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_ANIMATE_IMAGE=1

        echo
    fi
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

ignored_names = {".venv", "__pycache__", ".claude", ".pytest_cache", "input", "output"}
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

write_soul_md() {
    local dest="$1"
    local skills_path="${CONTAINER_PROFILE_DIR}/skills/abra"
    local workspace_path="${CONTAINER_PROFILE_DIR}/workspace"

    # Adapt the claw-parade SOUL.md to hermes — update paths, remove openclaw-
    # specific platform references, keep persona and objectives intact.
    python3 - "$dest" "$skills_path" "$workspace_path" <<'PY'
from pathlib import Path
import sys

dest = Path(sys.argv[1])
skills_path = sys.argv[2]
workspace_path = sys.argv[3]

import os
script_dir = Path(os.environ.get("SOURCE_ROOT", ""))
source_soul = script_dir / "SOUL.md" if script_dir.exists() else Path("SOUL.md")

if source_soul.exists():
    text = source_soul.read_text(encoding="utf-8")
    # Replace openclaw-specific paths with hermes profile paths
    text = text.replace("~/.openclaw/workspace-abra/skills", skills_path)
    text = text.replace("~/.openclaw/workspace-abra", workspace_path)
    text = text.replace("~/.openclaw/media", workspace_path + "/media")
    text = text.replace("~/.openclaw/", workspace_path + "/")
    dest.write_text(text, encoding="utf-8")
else:
    dest.write_text(
        "# Abra - Personal Brand Agent\n\n"
        "You are a Personal Brand Content Agent that transforms raw inputs into "
        "polished, multi-channel social media content. You orchestrate skill "
        "pipelines to process videos, images, and text for personal brand growth.\n\n"
        f"Skills: {skills_path}\n"
        f"Workspace: {workspace_path}\n",
        encoding="utf-8",
    )
PY
    echo "  ✓ SOUL.md"
}

write_config_yaml() {
    local dest="$1"
    local anthropic_key
    local openrouter_key

    anthropic_key="$(resolve_installer_env_value "ANTHROPIC_API_KEY")"
    openrouter_key="$(resolve_installer_env_value "OPENROUTER_API_KEY")"

    # Prefer Anthropic direct if key is available, fall back to OpenRouter
    local provider="auto"
    local model="anthropic/claude-sonnet-4-6"
    if [ -n "${anthropic_key}" ]; then
        provider="anthropic"
    elif [ -n "${openrouter_key}" ]; then
        provider="openrouter"
    fi

    cat > "${dest}" <<EOF
# Hermes Agent Configuration — profile: ${PROFILE_NAME}
# Generated by install-hermes.sh. Edit to customise.
model:
  default: "${model}"
  provider: "${provider}"

# Compact agent sessions when they grow large to keep context focused.
compact:
  enabled: true

# Agent personality: loaded from SOUL.md in this profile directory.
# Edit SOUL.md to change the agent's name, tone, and objectives.
EOF
    echo "  ✓ config.yaml (model: ${model}, provider: ${provider})"
}

write_env_file() {
    local dest="$1"

    # Collect all values from the source env file / shell env.
    local anthropic_api_key openrouter_api_key
    local telegram_bot_token telegram_allowed_users telegram_home_channel telegram_home_channel_name
    local buffer_api_key giphy_api_key freesound_api_key pixabay_api_key
    local hf_token replicate_api_token
    local runpod_api_key
    local runpod_endpoint_video_editor runpod_endpoint_video_matte runpod_endpoint_frame_interpolator
    local runpod_endpoint_bokeh_effect runpod_endpoint_background_remover runpod_endpoint_audio_splitter runpod_endpoint_photo_picker
    local ga4_client_id ga4_client_secret ga4_refresh_token ga4_property_id
    local google_ads_client_id google_ads_client_secret google_ads_refresh_token google_ads_developer_token
    local gsc_client_id gsc_client_secret gsc_refresh_token
    local resend_api_key mailchimp_api_key mailchimp_server_prefix sendgrid_api_key kit_api_key kit_api_secret dub_api_key
    local semrush_api_key ahrefs_api_key dataforseo_login dataforseo_password keywords_everywhere_api_key
    local plausible_api_key plausible_site_id
    local mixpanel_sa_username mixpanel_secret amplitude_api_key amplitude_secret_key
    local hotjar_site_id hotjar_api_token optimizely_sdk_key optimizely_access_token
    local posthog_project_id posthog_api_key posthog_project_api_key posthog_host posthog_app_host posthog_ingest_host
    local hubspot_access_token
    local salesforce_client_id salesforce_client_secret salesforce_username salesforce_password salesforce_security_token
    local close_api_key outreach_client_id outreach_client_secret outreach_refresh_token crossbeam_api_key
    local apollo_api_key clearbit_api_key zoominfo_username zoominfo_password clay_api_key segment_write_key
    local brave_api_key gh_token

    local fal_api_key

    # Always resolve platform keys (not skill-dependent)
    anthropic_api_key="$(resolve_installer_env_value "ANTHROPIC_API_KEY")"
    openrouter_api_key="$(resolve_installer_env_value "OPENROUTER_API_KEY")"
    telegram_bot_token="$(resolve_telegram_bot_token)"
    telegram_allowed_users="$(resolve_telegram_allowed_users)"
    telegram_home_channel="$(resolve_installer_env_value "TELEGRAM_HOME_CHANNEL")"
    telegram_home_channel_name="$(resolve_installer_env_value "TELEGRAM_HOME_CHANNEL_NAME")"
    brave_api_key="$(resolve_installer_env_value "BRAVE_API_KEY")"
    gh_token="$(resolve_installer_env_value "GH_TOKEN")"

    # Resolve skill-dependent keys only if skill is enabled
    if [ "${SKILL_ENABLED_POST_SCHEDULER}" = "1" ]; then
        buffer_api_key="$(resolve_installer_env_value "BUFFER_API_KEY")"
    fi
    if [ "${SKILL_ENABLED_GIPHY}" = "1" ]; then
        giphy_api_key="$(resolve_installer_env_value "GIPHY_API_KEY")"
    fi
    if [ "${SKILL_ENABLED_FREESOUND}" = "1" ]; then
        freesound_api_key="$(resolve_installer_env_value "FREESOUND_API_KEY")"
    fi
    if [ "${SKILL_ENABLED_PIXABAY}" = "1" ]; then
        pixabay_api_key="$(resolve_installer_env_value "PIXABAY_API_KEY")"
    fi
    if [ "${SKILL_ENABLED_ML_MODELS}" = "1" ]; then
        hf_token="$(resolve_installer_env_value "HF_TOKEN")"
        replicate_api_token="$(resolve_installer_env_value "REPLICATE_API_TOKEN")"
    fi
    if [ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ]; then
        runpod_api_key="$(resolve_installer_env_value "RUNPOD_API_KEY")"
        runpod_endpoint_video_editor="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR")"
        runpod_endpoint_video_matte="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_VIDEO_MATTE")"
        runpod_endpoint_frame_interpolator="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR")"
        runpod_endpoint_bokeh_effect="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_BOKEH_EFFECT")"
        runpod_endpoint_background_remover="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER")"
        runpod_endpoint_audio_splitter="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER")"
        runpod_endpoint_photo_picker="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_PHOTO_PICKER")"
    fi
    if [ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] || [ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ]; then
        ga4_client_id="$(resolve_installer_env_value "GA4_CLIENT_ID")"
        ga4_client_secret="$(resolve_installer_env_value "GA4_CLIENT_SECRET")"
        ga4_refresh_token="$(resolve_installer_env_value "GA4_REFRESH_TOKEN")"
        ga4_property_id="$(resolve_installer_env_value "GA4_PROPERTY_ID")"
    fi
    if [ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ]; then
        google_ads_client_id="$(resolve_installer_env_value "GOOGLE_ADS_CLIENT_ID")"
        google_ads_client_secret="$(resolve_installer_env_value "GOOGLE_ADS_CLIENT_SECRET")"
        google_ads_refresh_token="$(resolve_installer_env_value "GOOGLE_ADS_REFRESH_TOKEN")"
        google_ads_developer_token="$(resolve_installer_env_value "GOOGLE_ADS_DEVELOPER_TOKEN")"
        google_ads_customer_id="$(resolve_installer_env_value "GOOGLE_ADS_CUSTOMER_ID")"
        google_ads_login_customer_id="$(resolve_installer_env_value "GOOGLE_ADS_LOGIN_CUSTOMER_ID")"
    fi
    if [ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ]; then
        [ "${PROVIDER_ENABLED_GSC}" = "1" ] && gsc_client_id="$(resolve_installer_env_value "GSC_CLIENT_ID")" && gsc_client_secret="$(resolve_installer_env_value "GSC_CLIENT_SECRET")" && gsc_refresh_token="$(resolve_installer_env_value "GSC_REFRESH_TOKEN")"
        [ "${PROVIDER_ENABLED_SEMRUSH}" = "1" ] && semrush_api_key="$(resolve_installer_env_value "SEMRUSH_API_KEY")"
        [ "${PROVIDER_ENABLED_AHREFS}" = "1" ] && ahrefs_api_key="$(resolve_installer_env_value "AHREFS_API_KEY")"
        [ "${PROVIDER_ENABLED_DATAFORSEO}" = "1" ] && dataforseo_login="$(resolve_installer_env_value "DATAFORSEO_LOGIN")" && dataforseo_password="$(resolve_installer_env_value "DATAFORSEO_PASSWORD")"
        [ "${PROVIDER_ENABLED_KEYWORDS_EVERYWHERE}" = "1" ] && keywords_everywhere_api_key="$(resolve_installer_env_value "KEYWORDS_EVERYWHERE_API_KEY")"
        [ "${PROVIDER_ENABLED_PLAUSIBLE}" = "1" ] && plausible_api_key="$(resolve_installer_env_value "PLAUSIBLE_API_KEY")" && plausible_site_id="$(resolve_installer_env_value "PLAUSIBLE_SITE_ID")"
    fi
    if [ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ]; then
        [ "${PROVIDER_ENABLED_RESEND}" = "1" ] && resend_api_key="$(resolve_installer_env_value "RESEND_API_KEY")"
        [ "${PROVIDER_ENABLED_MAILCHIMP}" = "1" ] && mailchimp_api_key="$(resolve_installer_env_value "MAILCHIMP_API_KEY")" && mailchimp_server_prefix="$(resolve_installer_env_value "MAILCHIMP_SERVER_PREFIX")"
        [ "${PROVIDER_ENABLED_SENDGRID}" = "1" ] && sendgrid_api_key="$(resolve_installer_env_value "SENDGRID_API_KEY")"
        [ "${PROVIDER_ENABLED_KIT}" = "1" ] && kit_api_key="$(resolve_installer_env_value "KIT_API_KEY")" && kit_api_secret="$(resolve_installer_env_value "KIT_API_SECRET")"
        [ "${PROVIDER_ENABLED_DUB}" = "1" ] && dub_api_key="$(resolve_installer_env_value "DUB_API_KEY")"
    fi
    if [ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ]; then
        [ "${PROVIDER_ENABLED_MIXPANEL}" = "1" ] && mixpanel_sa_username="$(resolve_installer_env_value "MIXPANEL_SA_USERNAME")" && mixpanel_secret="$(resolve_installer_env_value "MIXPANEL_SECRET")"
        [ "${PROVIDER_ENABLED_AMPLITUDE}" = "1" ] && amplitude_api_key="$(resolve_installer_env_value "AMPLITUDE_API_KEY")" && amplitude_secret_key="$(resolve_installer_env_value "AMPLITUDE_SECRET_KEY")"
        [ "${PROVIDER_ENABLED_HOTJAR}" = "1" ] && hotjar_site_id="$(resolve_installer_env_value "HOTJAR_SITE_ID")" && hotjar_api_token="$(resolve_installer_env_value "HOTJAR_API_TOKEN")"
        [ "${PROVIDER_ENABLED_OPTIMIZELY}" = "1" ] && optimizely_sdk_key="$(resolve_installer_env_value "OPTIMIZELY_SDK_KEY")" && optimizely_access_token="$(resolve_installer_env_value "OPTIMIZELY_ACCESS_TOKEN")"
        [ "${PROVIDER_ENABLED_POSTHOG}" = "1" ] && posthog_project_id="$(resolve_installer_env_value "POSTHOG_PROJECT_ID")" && posthog_api_key="$(resolve_installer_env_value "POSTHOG_API_KEY")" && posthog_project_api_key="$(resolve_installer_env_value "POSTHOG_PROJECT_API_KEY")" && posthog_host="$(resolve_installer_env_value "POSTHOG_HOST")" && posthog_app_host="$(resolve_installer_env_value "POSTHOG_APP_HOST")" && posthog_ingest_host="$(resolve_installer_env_value "POSTHOG_INGEST_HOST")"
    fi
    if [ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ]; then
        [ "${PROVIDER_ENABLED_HUBSPOT}" = "1" ] && hubspot_access_token="$(resolve_installer_env_value "HUBSPOT_ACCESS_TOKEN")"
        [ "${PROVIDER_ENABLED_SALESFORCE}" = "1" ] && salesforce_client_id="$(resolve_installer_env_value "SALESFORCE_CLIENT_ID")" && salesforce_client_secret="$(resolve_installer_env_value "SALESFORCE_CLIENT_SECRET")" && salesforce_username="$(resolve_installer_env_value "SALESFORCE_USERNAME")" && salesforce_password="$(resolve_installer_env_value "SALESFORCE_PASSWORD")" && salesforce_security_token="$(resolve_installer_env_value "SALESFORCE_SECURITY_TOKEN")"
        [ "${PROVIDER_ENABLED_CLOSE}" = "1" ] && close_api_key="$(resolve_installer_env_value "CLOSE_API_KEY")"
        [ "${PROVIDER_ENABLED_OUTREACH}" = "1" ] && outreach_client_id="$(resolve_installer_env_value "OUTREACH_CLIENT_ID")" && outreach_client_secret="$(resolve_installer_env_value "OUTREACH_CLIENT_SECRET")" && outreach_refresh_token="$(resolve_installer_env_value "OUTREACH_REFRESH_TOKEN")"
        [ "${PROVIDER_ENABLED_CROSSBEAM}" = "1" ] && crossbeam_api_key="$(resolve_installer_env_value "CROSSBEAM_API_KEY")"
        [ "${PROVIDER_ENABLED_APOLLO}" = "1" ] && apollo_api_key="$(resolve_installer_env_value "APOLLO_API_KEY")"
        [ "${PROVIDER_ENABLED_CLEARBIT}" = "1" ] && clearbit_api_key="$(resolve_installer_env_value "CLEARBIT_API_KEY")"
        [ "${PROVIDER_ENABLED_ZOOMINFO}" = "1" ] && zoominfo_username="$(resolve_installer_env_value "ZOOMINFO_USERNAME")" && zoominfo_password="$(resolve_installer_env_value "ZOOMINFO_PASSWORD")"
        [ "${PROVIDER_ENABLED_CLAY}" = "1" ] && clay_api_key="$(resolve_installer_env_value "CLAY_API_KEY")"
        [ "${PROVIDER_ENABLED_SEGMENT}" = "1" ] && segment_write_key="$(resolve_installer_env_value "SEGMENT_WRITE_KEY")"
    fi
    if [ "${SKILL_ENABLED_ANIMATE_IMAGE}" = "1" ]; then
        fal_api_key="$(resolve_installer_env_value "FAL_API_KEY")"
    fi

    cat > "${dest}" <<EOF
# Hermes Agent .env — profile: ${PROFILE_NAME}
# Generated by install-hermes.sh. Edit to add/change values.

# =============================================================================
# LLM PROVIDER
# =============================================================================
ANTHROPIC_API_KEY="$(escape_env_value "${anthropic_api_key}")"
OPENROUTER_API_KEY="$(escape_env_value "${openrouter_api_key}")"

# =============================================================================
# TELEGRAM
# =============================================================================
TELEGRAM_BOT_TOKEN="$(escape_env_value "${telegram_bot_token}")"
TELEGRAM_ALLOWED_USERS="$(escape_env_value "${telegram_allowed_users}")"
TELEGRAM_HOME_CHANNEL="$(escape_env_value "${telegram_home_channel}")"
TELEGRAM_HOME_CHANNEL_NAME="$(escape_env_value "${telegram_home_channel_name}")"

# =============================================================================
# UTILITIES
# =============================================================================
BRAVE_API_KEY="$(escape_env_value "${brave_api_key}")"
GH_TOKEN="$(escape_env_value "${gh_token}")"

# =============================================================================
# CONTENT / MEDIA SKILL KEYS
# =============================================================================
BUFFER_API_KEY="$(escape_env_value "${buffer_api_key}")"
GIPHY_API_KEY="$(escape_env_value "${giphy_api_key}")"
FREESOUND_API_KEY="$(escape_env_value "${freesound_api_key}")"
PIXABAY_API_KEY="$(escape_env_value "${pixabay_api_key}")"
HF_TOKEN="$(escape_env_value "${hf_token}")"
REPLICATE_API_TOKEN="$(escape_env_value "${replicate_api_token}")"

# =============================================================================
# RUNPOD GPU INFERENCE
# =============================================================================
RUNPOD_API_KEY="$(escape_env_value "${runpod_api_key}")"
RUNPOD_ENDPOINT_ID_VIDEO_EDITOR="$(escape_env_value "${runpod_endpoint_video_editor}")"
RUNPOD_ENDPOINT_ID_VIDEO_MATTE="$(escape_env_value "${runpod_endpoint_video_matte}")"
RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR="$(escape_env_value "${runpod_endpoint_frame_interpolator}")"
RUNPOD_ENDPOINT_ID_BOKEH_EFFECT="$(escape_env_value "${runpod_endpoint_bokeh_effect}")"
RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER="$(escape_env_value "${runpod_endpoint_background_remover}")"
RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER="$(escape_env_value "${runpod_endpoint_audio_splitter}")"
RUNPOD_ENDPOINT_ID_PHOTO_PICKER="$(escape_env_value "${runpod_endpoint_photo_picker}")"

# =============================================================================
# ANALYTICS
# =============================================================================
GA4_CLIENT_ID="$(escape_env_value "${ga4_client_id}")"
GA4_CLIENT_SECRET="$(escape_env_value "${ga4_client_secret}")"
GA4_REFRESH_TOKEN="$(escape_env_value "${ga4_refresh_token}")"
GA4_PROPERTY_ID="$(escape_env_value "${ga4_property_id}")"
GOOGLE_ADS_CLIENT_ID="$(escape_env_value "${google_ads_client_id}")"
GOOGLE_ADS_CLIENT_SECRET="$(escape_env_value "${google_ads_client_secret}")"
GOOGLE_ADS_REFRESH_TOKEN="$(escape_env_value "${google_ads_refresh_token}")"
GOOGLE_ADS_DEVELOPER_TOKEN="$(escape_env_value "${google_ads_developer_token}")"
GOOGLE_ADS_CUSTOMER_ID="$(escape_env_value "${google_ads_customer_id}")"
GOOGLE_ADS_LOGIN_CUSTOMER_ID="$(escape_env_value "${google_ads_login_customer_id}")"
GSC_CLIENT_ID="$(escape_env_value "${gsc_client_id}")"
GSC_CLIENT_SECRET="$(escape_env_value "${gsc_client_secret}")"
GSC_REFRESH_TOKEN="$(escape_env_value "${gsc_refresh_token}")"

# =============================================================================
# EMAIL / MARKETING
# =============================================================================
RESEND_API_KEY="$(escape_env_value "${resend_api_key}")"
MAILCHIMP_API_KEY="$(escape_env_value "${mailchimp_api_key}")"
MAILCHIMP_SERVER_PREFIX="$(escape_env_value "${mailchimp_server_prefix}")"
SENDGRID_API_KEY="$(escape_env_value "${sendgrid_api_key}")"
KIT_API_KEY="$(escape_env_value "${kit_api_key}")"
KIT_API_SECRET="$(escape_env_value "${kit_api_secret}")"
DUB_API_KEY="$(escape_env_value "${dub_api_key}")"

# =============================================================================
# SEO
# =============================================================================
SEMRUSH_API_KEY="$(escape_env_value "${semrush_api_key}")"
AHREFS_API_KEY="$(escape_env_value "${ahrefs_api_key}")"
DATAFORSEO_LOGIN="$(escape_env_value "${dataforseo_login}")"
DATAFORSEO_PASSWORD="$(escape_env_value "${dataforseo_password}")"
KEYWORDS_EVERYWHERE_API_KEY="$(escape_env_value "${keywords_everywhere_api_key}")"
PLAUSIBLE_API_KEY="$(escape_env_value "${plausible_api_key}")"
PLAUSIBLE_SITE_ID="$(escape_env_value "${plausible_site_id}")"

# =============================================================================
# PRODUCT ANALYTICS
# =============================================================================
MIXPANEL_SA_USERNAME="$(escape_env_value "${mixpanel_sa_username}")"
MIXPANEL_SECRET="$(escape_env_value "${mixpanel_secret}")"
AMPLITUDE_API_KEY="$(escape_env_value "${amplitude_api_key}")"
AMPLITUDE_SECRET_KEY="$(escape_env_value "${amplitude_secret_key}")"
HOTJAR_SITE_ID="$(escape_env_value "${hotjar_site_id}")"
HOTJAR_API_TOKEN="$(escape_env_value "${hotjar_api_token}")"
OPTIMIZELY_SDK_KEY="$(escape_env_value "${optimizely_sdk_key}")"
OPTIMIZELY_ACCESS_TOKEN="$(escape_env_value "${optimizely_access_token}")"
POSTHOG_PROJECT_ID="$(escape_env_value "${posthog_project_id}")"
POSTHOG_API_KEY="$(escape_env_value "${posthog_api_key}")"
POSTHOG_PROJECT_API_KEY="$(escape_env_value "${posthog_project_api_key}")"
POSTHOG_HOST="$(escape_env_value "${posthog_host}")"
POSTHOG_APP_HOST="$(escape_env_value "${posthog_app_host}")"
POSTHOG_INGEST_HOST="$(escape_env_value "${posthog_ingest_host}")"

# =============================================================================
# CRM / REVENUE
# =============================================================================
HUBSPOT_ACCESS_TOKEN="$(escape_env_value "${hubspot_access_token}")"
SALESFORCE_CLIENT_ID="$(escape_env_value "${salesforce_client_id}")"
SALESFORCE_CLIENT_SECRET="$(escape_env_value "${salesforce_client_secret}")"
SALESFORCE_USERNAME="$(escape_env_value "${salesforce_username}")"
SALESFORCE_PASSWORD="$(escape_env_value "${salesforce_password}")"
SALESFORCE_SECURITY_TOKEN="$(escape_env_value "${salesforce_security_token}")"
CLOSE_API_KEY="$(escape_env_value "${close_api_key}")"
OUTREACH_CLIENT_ID="$(escape_env_value "${outreach_client_id}")"
OUTREACH_CLIENT_SECRET="$(escape_env_value "${outreach_client_secret}")"
OUTREACH_REFRESH_TOKEN="$(escape_env_value "${outreach_refresh_token}")"
CROSSBEAM_API_KEY="$(escape_env_value "${crossbeam_api_key}")"
APOLLO_API_KEY="$(escape_env_value "${apollo_api_key}")"
CLEARBIT_API_KEY="$(escape_env_value "${clearbit_api_key}")"
ZOOMINFO_USERNAME="$(escape_env_value "${zoominfo_username}")"
ZOOMINFO_PASSWORD="$(escape_env_value "${zoominfo_password}")"
CLAY_API_KEY="$(escape_env_value "${clay_api_key}")"
SEGMENT_WRITE_KEY="$(escape_env_value "${segment_write_key}")"

# =============================================================================
# FAUX.AI IMAGE ANIMATION
# =============================================================================
FAL_API_KEY="$(escape_env_value "${fal_api_key}")"
EOF
    append_selected_hermes_env_values "${dest}"
    chmod 600 "${dest}" 2>/dev/null || true
    echo "  ✓ .env"
}

# ============================================================================
# Entry point
# ============================================================================

parse_args "$@"

command -v python3 >/dev/null 2>&1 || { echo "python3 required"; exit 1; }

# Re-evaluate profile paths after arg parsing (in case --profile was used)
HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"
CONTAINER_PROFILE_DIR="${CONTAINER_HERMES_ROOT}/profiles/${PROFILE_NAME}"

echo "Installing Abra as Hermes profile '${PROFILE_NAME}'..."
echo

# Warn if the hermes-abra container is running — it will overwrite files we copy.
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^hermes-abra$'; then
    echo "Warning: container 'hermes-abra' is running and will overwrite copied files." >&2
    echo "Stop it first:  docker compose -f docker-compose.hermes.yml down" >&2
    if [ -t 0 ]; then
        read -r -p "Continue anyway? [y/N] " reply
        case "${reply}" in y|Y) ;; *) exit 1 ;; esac
    else
        echo "Non-interactive: aborting. Set HERMES_FORCE_INSTALL=1 to skip this check." >&2
        [ "${HERMES_FORCE_INSTALL:-0}" = "1" ] || exit 1
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PARENT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REPO_ROOT=""
if command -v git >/dev/null 2>&1; then
    REPO_ROOT="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -z "${REPO_ROOT}" ] && [ -d "${SCRIPT_PARENT}/skills" ]; then
    REPO_ROOT="${SCRIPT_PARENT}"
fi
[ -z "${REPO_ROOT}" ] && REPO_ROOT="${SCRIPT_DIR}"

if [ -n "${ENV_FILE_OVERRIDE}" ]; then
    ROOT_ENV_FILE="$(resolve_path "${ENV_FILE_OVERRIDE}")"
    if [ ! -f "${ROOT_ENV_FILE}" ]; then
        echo "Error: .env file not found: ${ROOT_ENV_FILE}" >&2
        exit 1
    fi
else
    ROOT_ENV_FILE="${REPO_ROOT}/.env"
fi

SOURCE_ROOT=""
if [ -n "$(git -C "${REPO_ROOT}" rev-parse --show-toplevel 2>/dev/null || true)" ] && [ -d "${REPO_ROOT}/skills" ]; then
    SOURCE_ROOT="${REPO_ROOT}"
else
    TEMP_CLONE=$(mktemp -d)
    git clone --depth 1 -b "${REPO_BRANCH}" "${REPO_URL}" "${TEMP_CLONE}"
    SOURCE_ROOT="${TEMP_CLONE}"
fi

export SOURCE_ROOT

# Select which skills to enable before any processing
select_hermes_env_copy_keys
select_enabled_skills

# ---------------------------------------------------------------------------
# Create profile through Hermes first so aliases/services/state are registered,
# then ensure Abra-specific directories exist.
# ---------------------------------------------------------------------------

ensure_hermes_profile
mkdir -p "${HOST_PROFILE_DIR}"/{memories,sessions,skills,skins,logs,plans,workspace,cron,hooks,home}
echo "  ✓ profile directory: ${HOST_PROFILE_DIR}"

# ---------------------------------------------------------------------------
# SOUL.md — adapted from claw-parade SOUL.md
# ---------------------------------------------------------------------------

write_soul_md "${HOST_PROFILE_DIR}/SOUL.md"

# ---------------------------------------------------------------------------
# workspace/ — agent's working directory for file operations.
# Holds documentation the agent reads; NOT a skills store.
# ---------------------------------------------------------------------------

if [ -f "${SOURCE_ROOT}/AGENTS.md" ]; then
    cp "${SOURCE_ROOT}/AGENTS.md" "${HOST_PROFILE_DIR}/workspace/AGENTS.md"
    echo "  ✓ workspace/AGENTS.md"
fi

if [ -f "${SOURCE_ROOT}/WORKFLOW.md" ]; then
    cp "${SOURCE_ROOT}/WORKFLOW.md" "${HOST_PROFILE_DIR}/workspace/WORKFLOW.md"
    echo "  ✓ workspace/WORKFLOW.md"
fi

# ---------------------------------------------------------------------------
# skills/abra/ — claw-parade skills installed directly as hermes skills.
# Each skill directory (with its SKILL.md + Python scripts) lives here so
# hermes discovers and surfaces them without a separate workspace/skills/ tree.
# ---------------------------------------------------------------------------

HERMES_SKILL_CATEGORY="${HOST_PROFILE_DIR}/skills/abra"
mkdir -p "${HERMES_SKILL_CATEGORY}"

cat > "${HERMES_SKILL_CATEGORY}/DESCRIPTION.md" <<'DESCRIPTION'
---
description: Abra — Personal brand content production skills. Media processing, scheduling, and brand management.
---

# Abra Skills

Python-based media production skills for the Abra personal brand agent.
Each skill directory contains a SKILL.md, Python scripts, and a uv.lock.
Run with: `cd skills/abra/<name> && uv sync && uv run python scripts/<script>.py`
DESCRIPTION

SKILL_SOURCE="${SOURCE_ROOT}/skills"
for skill_dir in "${SKILL_SOURCE}"/*; do
    [ -d "${skill_dir}" ] || continue
    skill_name=$(basename "${skill_dir}")
    [[ "${skill_name}" == "input" || "${skill_name}" == "output" || "${skill_name}" == "_providers" || "${skill_name}" == "__pycache__" || "${skill_name}" == "__init__.py" ]] && continue

    # Check if this skill should be copied based on enablement
    skip_skill=1
    case "${skill_name}" in
        post-scheduler) [ "${SKILL_ENABLED_POST_SCHEDULER}" = "1" ] && skip_skill=0 ;;
        giphy) [ "${SKILL_ENABLED_GIPHY}" = "1" ] && skip_skill=0 ;;
        freesound) [ "${SKILL_ENABLED_FREESOUND}" = "1" ] && skip_skill=0 ;;
        pixabay) [ "${SKILL_ENABLED_PIXABAY}" = "1" ] && skip_skill=0 ;;
        email-campaigner) [ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && skip_skill=0 ;;
        seo-researcher) [ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && skip_skill=0 ;;
        ads-manager) [ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && skip_skill=0 ;;
        funnel-optimizer) [ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && skip_skill=0 ;;
        revenue-manager) [ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && skip_skill=0 ;;
        animate-image) [ "${SKILL_ENABLED_ANIMATE_IMAGE}" = "1" ] && skip_skill=0 ;;
        *) skip_skill=0 ;; # Always copy skills that don't require API keys
    esac

    [ "${skip_skill}" = "1" ] && continue

    copy_directory_clean "${skill_dir}" "${HERMES_SKILL_CATEGORY}/${skill_name}"
    echo "  + skills/abra/${skill_name}"
done
echo "  ✓ skills/abra/"

# ---------------------------------------------------------------------------
# config.yaml — copy from ~/.hermes/config.yaml if present, otherwise generate
# ---------------------------------------------------------------------------

if [ -f "${HOST_HERMES_ROOT}/config.yaml" ]; then
    cp "${HOST_HERMES_ROOT}/config.yaml" "${HOST_PROFILE_DIR}/config.yaml"
    echo "  ✓ config.yaml (copied from ${HOST_HERMES_ROOT}/config.yaml)"
else
    write_config_yaml "${HOST_PROFILE_DIR}/config.yaml"
fi

# ---------------------------------------------------------------------------
# sessions/sessions.json — the real source of truth for telegram channels.
# channel_directory.json is rebuilt from this on every gateway start, so
# copying the sessions index is what makes telegram contacts stick.
# ---------------------------------------------------------------------------

if [ -f "${HOST_HERMES_ROOT}/sessions/sessions.json" ]; then
    cp "${HOST_HERMES_ROOT}/sessions/sessions.json" "${HOST_PROFILE_DIR}/sessions/sessions.json"
    echo "  ✓ sessions/sessions.json (copied from ${HOST_HERMES_ROOT}/sessions/sessions.json)"
fi

# ---------------------------------------------------------------------------
# channel_directory.json — copy as well so it's correct before first start
# ---------------------------------------------------------------------------

if [ -f "${HOST_HERMES_ROOT}/channel_directory.json" ]; then
    cp "${HOST_HERMES_ROOT}/channel_directory.json" "${HOST_PROFILE_DIR}/channel_directory.json"
    echo "  ✓ channel_directory.json (copied from ${HOST_HERMES_ROOT}/channel_directory.json)"
fi

# ---------------------------------------------------------------------------
# auth.json — default profile Portal/OAuth token store, copied for deployments
# that expect profile-local auth material.
# ---------------------------------------------------------------------------

copy_default_auth_json

# ---------------------------------------------------------------------------
# .env
# ---------------------------------------------------------------------------

write_env_file "${HOST_PROFILE_DIR}/.env"

# ---------------------------------------------------------------------------
# Gateway service — use Hermes CLI so service names and launchd/systemd files
# match Hermes' profile-aware gateway conventions.
# ---------------------------------------------------------------------------

install_hermes_gateway

# ---------------------------------------------------------------------------
# Cleanup temp clone if used
# ---------------------------------------------------------------------------

[ -n "${TEMP_CLONE:-}" ] && rm -rf "${TEMP_CLONE}"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo
echo "Done! Hermes profile '${PROFILE_NAME}' installed."
echo "Profile:   ${HOST_PROFILE_DIR}"
echo "Skills:    ${HOST_PROFILE_DIR}/skills/abra"
echo "Workspace: ${HOST_PROFILE_DIR}/workspace"
echo
echo "Run with Docker (set HERMES_HOME=/opt/data/profiles/${PROFILE_NAME}):"
echo "  docker compose -f docker-compose.hermes.yml up -d"
echo
echo "Run natively:"
echo "  ${PROFILE_NAME} gateway start"
echo "  ${PROFILE_NAME} chat"
echo "  # or: hermes -p ${PROFILE_NAME} gateway start"
echo
echo "Customise: edit ${HOST_PROFILE_DIR}/SOUL.md, .env, config.yaml"
