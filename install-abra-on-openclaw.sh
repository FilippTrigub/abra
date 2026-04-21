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
BACKBLAZE_B2_RUNPOD_ENV_FILE="${HOST_OPENCLAW_DIR}/runpod-backblaze.env"
BACKBLAZE_B2_RUNPOD_ENV_FILE_CONTAINER="${CONTAINER_OPENCLAW_DIR}/runpod-backblaze.env"
LEGACY_POST_SCHEDULER_ENV_FILE="${AGENT_WORKSPACE_HOST}/skills/post-scheduler/.env"
ENV_FILE_OVERRIDE=""

usage() {
    cat <<EOF
Usage: $0 [--env-file PATH]

Options:
  -e, --env-file PATH   Use PATH as the source .env file for installer env values
  -h, --help            Show this help message
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

read_config_env_value() {
    local file="$1"
    local key="$2"
    [ -f "${file}" ] || return 0

    jq -r --arg key "${key}" '.env[$key] // empty' "${file}"
}

read_env_state() {
    local file="$1"
    local key="$2"
    [ -f "${file}" ] || {
        printf 'missing'
        return 0
    }

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
    value = value.strip()
    print("set" if value else "empty")
    break
else:
    print("missing")
PY
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

    if [ -n "${ROOT_ENV_FILE:-}" ] && [ -f "${ROOT_ENV_FILE}" ]; then
        value="$(read_env_value "${ROOT_ENV_FILE}" "${key}")"
        if [ -n "${value}" ]; then
            printf '%s' "${value}"
            return 0
        fi
    fi

    value="$(read_config_env_value "${CONFIG_FILE}" "${key}")"
    if [ -n "${value}" ]; then
        printf '%s' "${value}"
        return 0
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
        funnel-optimizer) printf '%s\n' "GA4_CLIENT_ID" "GA4_CLIENT_SECRET" "GA4_REFRESH_TOKEN" "GA4_PROPERTY_ID" "MIXPANEL_SA_USERNAME" "MIXPANEL_SECRET" "AMPLITUDE_API_KEY" "AMPLITUDE_SECRET_KEY" "HOTJAR_SITE_ID" "HOTJAR_API_TOKEN" "OPTIMIZELY_SDK_KEY" "OPTIMIZELY_ACCESS_TOKEN" ;;
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

expected_skill_env_keys() {
    cat <<'EOF'
BUFFER_API_KEY
GIPHY_API_KEY
FREESOUND_API_KEY
PIXABAY_API_KEY
HF_TOKEN
REPLICATE_API_TOKEN
RUNPOD_API_KEY
RUNPOD_ENDPOINT_ID_VIDEO_EDITOR
RUNPOD_ENDPOINT_ID_VIDEO_MATTE
RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR
RUNPOD_ENDPOINT_ID_BOKEH_EFFECT
RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER
RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER
RUNPOD_ENDPOINT_ID_PHOTO_PICKER
GA4_CLIENT_ID
GA4_CLIENT_SECRET
GA4_REFRESH_TOKEN
GA4_PROPERTY_ID
GOOGLE_ADS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET
GOOGLE_ADS_REFRESH_TOKEN
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_CUSTOMER_ID
GOOGLE_ADS_LOGIN_CUSTOMER_ID
GSC_CLIENT_ID
GSC_CLIENT_SECRET
GSC_REFRESH_TOKEN
RESEND_API_KEY
MAILCHIMP_API_KEY
MAILCHIMP_SERVER_PREFIX
SENDGRID_API_KEY
KIT_API_KEY
KIT_API_SECRET
DUB_API_KEY
SEMRUSH_API_KEY
AHREFS_API_KEY
DATAFORSEO_LOGIN
DATAFORSEO_PASSWORD
KEYWORDS_EVERYWHERE_API_KEY
PLAUSIBLE_API_KEY
PLAUSIBLE_SITE_ID
MIXPANEL_SA_USERNAME
MIXPANEL_SECRET
AMPLITUDE_API_KEY
AMPLITUDE_SECRET_KEY
HOTJAR_SITE_ID
HOTJAR_API_TOKEN
OPTIMIZELY_SDK_KEY
OPTIMIZELY_ACCESS_TOKEN
HUBSPOT_ACCESS_TOKEN
SALESFORCE_CLIENT_ID
SALESFORCE_CLIENT_SECRET
SALESFORCE_USERNAME
SALESFORCE_PASSWORD
SALESFORCE_SECURITY_TOKEN
CLOSE_API_KEY
OUTREACH_CLIENT_ID
OUTREACH_CLIENT_SECRET
OUTREACH_REFRESH_TOKEN
CROSSBEAM_API_KEY
APOLLO_API_KEY
CLEARBIT_API_KEY
ZOOMINFO_USERNAME
ZOOMINFO_PASSWORD
CLAY_API_KEY
SEGMENT_WRITE_KEY
FAL_API_KEY
EOF
}

env_key_skill_labels() {
    local key="$1"

    case "${key}" in
        BUFFER_API_KEY)
            printf '%s\n' "post-scheduler"
            ;;
        GIPHY_API_KEY)
            printf '%s\n' "giphy"
            ;;
        FREESOUND_API_KEY)
            printf '%s\n' "freesound"
            ;;
        PIXABAY_API_KEY)
            printf '%s\n' "pixabay"
            ;;
        RESEND_API_KEY|MAILCHIMP_API_KEY|MAILCHIMP_SERVER_PREFIX|SENDGRID_API_KEY|KIT_API_KEY|KIT_API_SECRET|DUB_API_KEY)
            printf '%s\n' "email-campaigner"
            ;;
        GSC_CLIENT_ID|GSC_CLIENT_SECRET|GSC_REFRESH_TOKEN|SEMRUSH_API_KEY|AHREFS_API_KEY|DATAFORSEO_LOGIN|DATAFORSEO_PASSWORD|KEYWORDS_EVERYWHERE_API_KEY|PLAUSIBLE_API_KEY|PLAUSIBLE_SITE_ID)
            printf '%s\n' "seo-researcher"
            ;;
        GA4_CLIENT_ID|GA4_CLIENT_SECRET|GA4_REFRESH_TOKEN|GA4_PROPERTY_ID)
            printf '%s\n' "ads-manager" "funnel-optimizer"
            ;;
        GOOGLE_ADS_CLIENT_ID|GOOGLE_ADS_CLIENT_SECRET|GOOGLE_ADS_REFRESH_TOKEN|GOOGLE_ADS_DEVELOPER_TOKEN|GOOGLE_ADS_CUSTOMER_ID|GOOGLE_ADS_LOGIN_CUSTOMER_ID)
            printf '%s\n' "ads-manager"
            ;;
        MIXPANEL_SA_USERNAME|MIXPANEL_SECRET|AMPLITUDE_API_KEY|AMPLITUDE_SECRET_KEY|HOTJAR_SITE_ID|HOTJAR_API_TOKEN|OPTIMIZELY_SDK_KEY|OPTIMIZELY_ACCESS_TOKEN)
            printf '%s\n' "funnel-optimizer"
            ;;
        HUBSPOT_ACCESS_TOKEN|SALESFORCE_CLIENT_ID|SALESFORCE_CLIENT_SECRET|SALESFORCE_USERNAME|SALESFORCE_PASSWORD|SALESFORCE_SECURITY_TOKEN|CLOSE_API_KEY|OUTREACH_CLIENT_ID|OUTREACH_CLIENT_SECRET|OUTREACH_REFRESH_TOKEN|CROSSBEAM_API_KEY|APOLLO_API_KEY|CLEARBIT_API_KEY|ZOOMINFO_USERNAME|ZOOMINFO_PASSWORD|CLAY_API_KEY|SEGMENT_WRITE_KEY)
            printf '%s\n' "revenue-manager"
            ;;
        *)
            printf '%s\n' "unmapped"
            ;;
    esac
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

    # Initialize provider selections (multi-provider skills)
    PROVIDER_ENABLED_RESEND=0
    PROVIDER_ENABLED_MAILCHIMP=0
    PROVIDER_ENABLED_SENDGRID=0
    PROVIDER_ENABLED_KIT=0
    PROVIDER_ENABLED_DUB=0
    PROVIDER_ENABLED_GSC=0
    PROVIDER_ENABLED_SEMRUSH=0
    PROVIDER_ENABLED_AHREFS=0
    PROVIDER_ENABLED_DATAFORSEO=0
    PROVIDER_ENABLED_KEYWORDS_EVERYWHERE=0
    PROVIDER_ENABLED_PLAUSIBLE=0
    PROVIDER_ENABLED_MIXPANEL=0
    PROVIDER_ENABLED_AMPLITUDE=0
    PROVIDER_ENABLED_HOTJAR=0
    PROVIDER_ENABLED_OPTIMIZELY=0
    PROVIDER_ENABLED_HUBSPOT=0
    PROVIDER_ENABLED_SALESFORCE=0
    PROVIDER_ENABLED_CLOSE=0
    PROVIDER_ENABLED_OUTREACH=0
    PROVIDER_ENABLED_CROSSBEAM=0
    PROVIDER_ENABLED_APOLLO=0
    PROVIDER_ENABLED_CLEARBIT=0
    PROVIDER_ENABLED_ZOOMINFO=0
    PROVIDER_ENABLED_CLAY=0
    PROVIDER_ENABLED_SEGMENT=0

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
        # Enable all providers
        PROVIDER_ENABLED_RESEND=1; PROVIDER_ENABLED_MAILCHIMP=1; PROVIDER_ENABLED_SENDGRID=1; PROVIDER_ENABLED_KIT=1; PROVIDER_ENABLED_DUB=1
        PROVIDER_ENABLED_GSC=1; PROVIDER_ENABLED_SEMRUSH=1; PROVIDER_ENABLED_AHREFS=1; PROVIDER_ENABLED_DATAFORSEO=1; PROVIDER_ENABLED_KEYWORDS_EVERYWHERE=1; PROVIDER_ENABLED_PLAUSIBLE=1
        PROVIDER_ENABLED_MIXPANEL=1; PROVIDER_ENABLED_AMPLITUDE=1; PROVIDER_ENABLED_HOTJAR=1; PROVIDER_ENABLED_OPTIMIZELY=1
        PROVIDER_ENABLED_HUBSPOT=1; PROVIDER_ENABLED_SALESFORCE=1; PROVIDER_ENABLED_CLOSE=1; PROVIDER_ENABLED_OUTREACH=1; PROVIDER_ENABLED_CROSSBEAM=1; PROVIDER_ENABLED_APOLLO=1; PROVIDER_ENABLED_CLEARBIT=1; PROVIDER_ENABLED_ZOOMINFO=1; PROVIDER_ENABLED_CLAY=1; PROVIDER_ENABLED_SEGMENT=1
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
                email-campaigner) SKILL_ENABLED_EMAIL_CAMPAIGNER=1; PROVIDER_ENABLED_RESEND=1; PROVIDER_ENABLED_MAILCHIMP=1; PROVIDER_ENABLED_SENDGRID=1; PROVIDER_ENABLED_KIT=1; PROVIDER_ENABLED_DUB=1 ;;
                seo-researcher) SKILL_ENABLED_SEO_RESEARCHER=1; PROVIDER_ENABLED_GSC=1; PROVIDER_ENABLED_SEMRUSH=1; PROVIDER_ENABLED_AHREFS=1; PROVIDER_ENABLED_DATAFORSEO=1; PROVIDER_ENABLED_KEYWORDS_EVERYWHERE=1; PROVIDER_ENABLED_PLAUSIBLE=1 ;;
                ads-manager) SKILL_ENABLED_ADS_MANAGER=1 ;;
                funnel-optimizer) SKILL_ENABLED_FUNNEL_OPTIMIZER=1; PROVIDER_ENABLED_MIXPANEL=1; PROVIDER_ENABLED_AMPLITUDE=1; PROVIDER_ENABLED_HOTJAR=1; PROVIDER_ENABLED_OPTIMIZELY=1 ;;
                revenue-manager) SKILL_ENABLED_REVENUE_MANAGER=1; PROVIDER_ENABLED_HUBSPOT=1; PROVIDER_ENABLED_SALESFORCE=1; PROVIDER_ENABLED_CLOSE=1; PROVIDER_ENABLED_OUTREACH=1; PROVIDER_ENABLED_CROSSBEAM=1; PROVIDER_ENABLED_APOLLO=1; PROVIDER_ENABLED_CLEARBIT=1; PROVIDER_ENABLED_ZOOMINFO=1; PROVIDER_ENABLED_CLAY=1; PROVIDER_ENABLED_SEGMENT=1 ;;
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
        if read -r -p "Enable email-campaigner (email marketing)? [${default}]: " reply; [ "${reply:-${default}}" = "y" ]; then
            SKILL_ENABLED_EMAIL_CAMPAIGNER=1
            echo "  Email providers: Resend, Mailchimp, SendGrid, Kit, Dub"
            read -r -p "  Enter providers (comma-separated, or 'all') [all]: " providers
            if [ -z "${providers}" ] || [ "${providers}" = "all" ]; then
                PROVIDER_ENABLED_RESEND=1; PROVIDER_ENABLED_MAILCHIMP=1; PROVIDER_ENABLED_SENDGRID=1; PROVIDER_ENABLED_KIT=1; PROVIDER_ENABLED_DUB=1
            else
                IFS=',' read -ra prov_list <<< "${providers}"
                for p in "${prov_list[@]}"; do
                    p="$(printf '%s' "${p}" | xargs | tr '[:upper:]' '[:lower:]')"
                    case "${p}" in
                        resend) PROVIDER_ENABLED_RESEND=1 ;;
                        mailchimp) PROVIDER_ENABLED_MAILCHIMP=1 ;;
                        sendgrid) PROVIDER_ENABLED_SENDGRID=1 ;;
                        kit) PROVIDER_ENABLED_KIT=1 ;;
                        dub) PROVIDER_ENABLED_DUB=1 ;;
                    esac
                done
            fi
        fi

        default="N"; skill_has_any_value "seo-researcher" && default="y"
        if read -r -p "Enable seo-researcher (SEO research)? [${default}]: " reply; [ "${reply:-${default}}" = "y" ]; then
            SKILL_ENABLED_SEO_RESEARCHER=1
            echo "  SEO providers: GSC, SEMRUSH, Ahrefs, DataForSEO, Keywords-Everywhere, Plausible"
            read -r -p "  Enter providers (comma-separated, or 'all') [all]: " providers
            if [ -z "${providers}" ] || [ "${providers}" = "all" ]; then
                PROVIDER_ENABLED_GSC=1; PROVIDER_ENABLED_SEMRUSH=1; PROVIDER_ENABLED_AHREFS=1; PROVIDER_ENABLED_DATAFORSEO=1; PROVIDER_ENABLED_KEYWORDS_EVERYWHERE=1; PROVIDER_ENABLED_PLAUSIBLE=1
            else
                IFS=',' read -ra prov_list <<< "${providers}"
                for p in "${prov_list[@]}"; do
                    p="$(printf '%s' "${p}" | xargs | tr '[:upper:]' '[:lower:]')"
                    case "${p}" in
                        gsc) PROVIDER_ENABLED_GSC=1 ;;
                        semrush) PROVIDER_ENABLED_SEMRUSH=1 ;;
                        ahrefs) PROVIDER_ENABLED_AHREFS=1 ;;
                        dataforseo) PROVIDER_ENABLED_DATAFORSEO=1 ;;
                        keywords-everywhere|keywords_everywhere) PROVIDER_ENABLED_KEYWORDS_EVERYWHERE=1 ;;
                        plausible) PROVIDER_ENABLED_PLAUSIBLE=1 ;;
                    esac
                done
            fi
        fi

        default="N"; skill_has_any_value "ads-manager" && default="y"
        read -r -p "Enable ads-manager (Google Ads)? [${default}]: " reply
        [ "${reply:-${default}}" = "y" ] && SKILL_ENABLED_ADS_MANAGER=1

        default="N"; skill_has_any_value "funnel-optimizer" && default="y"
        if read -r -p "Enable funnel-optimizer (analytics)? [${default}]: " reply; [ "${reply:-${default}}" = "y" ]; then
            SKILL_ENABLED_FUNNEL_OPTIMIZER=1
            echo "  Analytics providers: Mixpanel, Amplitude, Hotjar, Optimizely (need at least one)"
            read -r -p "  Enter providers (comma-separated, or 'all') [all]: " providers
            if [ -z "${providers}" ] || [ "${providers}" = "all" ]; then
                PROVIDER_ENABLED_MIXPANEL=1; PROVIDER_ENABLED_AMPLITUDE=1; PROVIDER_ENABLED_HOTJAR=1; PROVIDER_ENABLED_OPTIMIZELY=1
            else
                IFS=',' read -ra prov_list <<< "${providers}"
                for p in "${prov_list[@]}"; do
                    p="$(printf '%s' "${p}" | xargs | tr '[:upper:]' '[:lower:]')"
                    case "${p}" in
                        mixpanel) PROVIDER_ENABLED_MIXPANEL=1 ;;
                        amplitude) PROVIDER_ENABLED_AMPLITUDE=1 ;;
                        hotjar) PROVIDER_ENABLED_HOTJAR=1 ;;
                        optimizely) PROVIDER_ENABLED_OPTIMIZELY=1 ;;
                    esac
                done
            fi
        fi

        default="N"; skill_has_any_value "revenue-manager" && default="y"
        if read -r -p "Enable revenue-manager (CRM operations)? [${default}]: " reply; [ "${reply:-${default}}" = "y" ]; then
            SKILL_ENABLED_REVENUE_MANAGER=1
            echo "  CRM providers: HubSpot, Salesforce, Close, Outreach, Crossbeam, Apollo, Clearbit, ZoomInfo, Clay, Segment"
            read -r -p "  Enter providers (comma-separated, or 'all') [all]: " providers
            if [ -z "${providers}" ] || [ "${providers}" = "all" ]; then
                PROVIDER_ENABLED_HUBSPOT=1; PROVIDER_ENABLED_SALESFORCE=1; PROVIDER_ENABLED_CLOSE=1; PROVIDER_ENABLED_OUTREACH=1; PROVIDER_ENABLED_CROSSBEAM=1; PROVIDER_ENABLED_APOLLO=1; PROVIDER_ENABLED_CLEARBIT=1; PROVIDER_ENABLED_ZOOMINFO=1; PROVIDER_ENABLED_CLAY=1; PROVIDER_ENABLED_SEGMENT=1
            else
                IFS=',' read -ra prov_list <<< "${providers}"
                for p in "${prov_list[@]}"; do
                    p="$(printf '%s' "${p}" | xargs | tr '[:upper:]' '[:lower:]')"
                    case "${p}" in
                        hubspot) PROVIDER_ENABLED_HUBSPOT=1 ;;
                        salesforce) PROVIDER_ENABLED_SALESFORCE=1 ;;
                        close) PROVIDER_ENABLED_CLOSE=1 ;;
                        outreach) PROVIDER_ENABLED_OUTREACH=1 ;;
                        crossbeam) PROVIDER_ENABLED_CROSSBEAM=1 ;;
                        apollo) PROVIDER_ENABLED_APOLLO=1 ;;
                        clearbit) PROVIDER_ENABLED_CLEARBIT=1 ;;
                        zoominfo) PROVIDER_ENABLED_ZOOMINFO=1 ;;
                        clay) PROVIDER_ENABLED_CLAY=1 ;;
                        segment) PROVIDER_ENABLED_SEGMENT=1 ;;
                    esac
                done
            fi
        fi

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

warn_unset_skill_env_values() {
    local missing_keys=()
    local empty_keys=()
    local key=""
    local state=""
    local reply=""
    local skill=""

    declare -A missing_keys_by_skill=()
    declare -A empty_keys_by_skill=()
    declare -A missing_skill_seen=()
    declare -A empty_skill_seen=()
    local missing_skill_order=()
    local empty_skill_order=()

    add_key_to_skill_group() {
        local group_type="$1"
        local group_skill="$2"
        local group_key="$3"

        case "${group_type}" in
            missing)
                if [ -z "${missing_skill_seen[${group_skill}]:-}" ]; then
                    missing_skill_seen[${group_skill}]=1
                    missing_skill_order+=("${group_skill}")
                fi
                if [ -n "${missing_keys_by_skill[${group_skill}]:-}" ]; then
                    missing_keys_by_skill[${group_skill}]+=$'\n'
                fi
                missing_keys_by_skill[${group_skill}]+="${group_key}"
                ;;
            empty)
                if [ -z "${empty_skill_seen[${group_skill}]:-}" ]; then
                    empty_skill_seen[${group_skill}]=1
                    empty_skill_order+=("${group_skill}")
                fi
                if [ -n "${empty_keys_by_skill[${group_skill}]:-}" ]; then
                    empty_keys_by_skill[${group_skill}]+=$'\n'
                fi
                empty_keys_by_skill[${group_skill}]+="${group_key}"
                ;;
        esac
    }

    echo

    if [ -z "${ROOT_ENV_FILE:-}" ]; then
        echo "  • No source .env file configured; skipping env import"
        return 0
    fi

    if [ ! -f "${ROOT_ENV_FILE}" ]; then
        echo "  • Source .env file not found: ${ROOT_ENV_FILE}"
        echo "    Continuing with shell env and existing openclaw.json env values"
        return 0
    fi

    echo "  → Loading installer env values from: ${ROOT_ENV_FILE}"

    while IFS= read -r key; do
        [ -n "${key}" ] || continue

        # Check if this key belongs to an enabled skill
        local key_skill
        key_skill="$(env_key_skill_labels "${key}" | head -1)"
        if [ -n "${key_skill}" ]; then
            local enabled_var="SKILL_ENABLED_${key_skill^^}"
            enabled_var="${enabled_var//-/_}"
            [ "${!enabled_var:-0}" = "1" ] || continue
        fi

        state="$(read_env_state "${ROOT_ENV_FILE}" "${key}")"
        case "${state}" in
            missing)
                missing_keys+=("${key}")
                while IFS= read -r skill; do
                    [ -n "${skill}" ] || continue
                    add_key_to_skill_group missing "${skill}" "${key}"
                done < <(env_key_skill_labels "${key}")
                ;;
            empty)
                empty_keys+=("${key}")
                while IFS= read -r skill; do
                    [ -n "${skill}" ] || continue
                    add_key_to_skill_group empty "${skill}" "${key}"
                done < <(env_key_skill_labels "${key}")
                ;;
        esac
    done < <(expected_skill_env_keys)

    if [ "${#missing_keys[@]}" -eq 0 ] && [ "${#empty_keys[@]}" -eq 0 ]; then
        echo "  ✓ All expected skill env vars are set in the selected .env file"
        return 0
    fi

    echo "  • Warning: some expected skill env vars are unset in ${ROOT_ENV_FILE}"
    if [ "${#missing_keys[@]}" -gt 0 ]; then
        echo "    Missing keys by skill:"
        for skill in "${missing_skill_order[@]}"; do
            [ -n "${missing_keys_by_skill[${skill}]:-}" ] || continue
            echo "      ${skill}:"
            while IFS= read -r missing_key; do
                [ -n "${missing_key}" ] || continue
                echo "        - ${missing_key}"
            done <<< "${missing_keys_by_skill[${skill}]}"
        done
    fi
    if [ "${#empty_keys[@]}" -gt 0 ]; then
        echo "    Empty keys by skill:"
        for skill in "${empty_skill_order[@]}"; do
            [ -n "${empty_keys_by_skill[${skill}]:-}" ] || continue
            echo "      ${skill}:"
            while IFS= read -r empty_key; do
                [ -n "${empty_key}" ] || continue
                echo "        - ${empty_key}"
            done <<< "${empty_keys_by_skill[${skill}]}"
        done
    fi
    echo "    Missing values will fall back to shell env or existing openclaw.json env when available"

    if [ "${#missing_keys[@]}" -gt 0 ]; then
        echo
        if [ -t 0 ]; then
            read -r -p "Continue installation with missing keys? [y/N] " reply
            case "${reply}" in
                y|Y|yes|YES)
                    ;;
                *)
                    echo "Installation cancelled. Add the missing keys and rerun the installer."
                    exit 1
                    ;;
            esac
        else
            echo "Installation cancelled: missing keys require explicit confirmation in an interactive shell."
            exit 1
        fi
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
    warn_unset_skill_env_values

    local buffer_api_key giphy_api_key freesound_api_key pixabay_api_key
    local hf_token replicate_api_token
    local runpod_api_key
    local runpod_endpoint_video_editor runpod_endpoint_video_matte runpod_endpoint_frame_interpolator
    local runpod_endpoint_bokeh_effect runpod_endpoint_background_remover runpod_endpoint_audio_splitter runpod_endpoint_photo_picker
    local ga4_client_id ga4_client_secret ga4_refresh_token ga4_property_id
    local google_ads_client_id google_ads_client_secret google_ads_refresh_token google_ads_developer_token google_ads_customer_id google_ads_login_customer_id
    local gsc_client_id gsc_client_secret gsc_refresh_token
    local resend_api_key mailchimp_api_key mailchimp_server_prefix sendgrid_api_key kit_api_key kit_api_secret dub_api_key
    local semrush_api_key ahrefs_api_key dataforseo_login dataforseo_password keywords_everywhere_api_key
    local plausible_api_key plausible_site_id
    local mixpanel_sa_username mixpanel_secret amplitude_api_key amplitude_secret_key
    local hotjar_site_id hotjar_api_token optimizely_sdk_key optimizely_access_token
    local hubspot_access_token
    local salesforce_client_id salesforce_client_secret salesforce_username salesforce_password salesforce_security_token
    local close_api_key outreach_client_id outreach_client_secret outreach_refresh_token crossbeam_api_key
    local apollo_api_key clearbit_api_key zoominfo_username zoominfo_password clay_api_key segment_write_key
    local fal_api_key

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

    if [ "${SKILL_ENABLED_ANIMATE_IMAGE}" = "1" ]; then
        fal_api_key="$(resolve_installer_env_value "FAL_API_KEY")"
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

    INSTALL_BUFFER_API_KEY="${buffer_api_key}"
    INSTALL_GIPHY_API_KEY="${giphy_api_key}"
    INSTALL_FREESOUND_API_KEY="${freesound_api_key}"
    INSTALL_PIXABAY_API_KEY="${pixabay_api_key}"
    INSTALL_HF_TOKEN="${hf_token}"
    INSTALL_REPLICATE_API_TOKEN="${replicate_api_token}"
    INSTALL_RUNPOD_API_KEY="${runpod_api_key}"
    INSTALL_RUNPOD_ENDPOINT_VIDEO_EDITOR="${runpod_endpoint_video_editor}"
    INSTALL_RUNPOD_ENDPOINT_VIDEO_MATTE="${runpod_endpoint_video_matte}"
    INSTALL_RUNPOD_ENDPOINT_FRAME_INTERPOLATOR="${runpod_endpoint_frame_interpolator}"
    INSTALL_RUNPOD_ENDPOINT_BOKEH_EFFECT="${runpod_endpoint_bokeh_effect}"
    INSTALL_RUNPOD_ENDPOINT_BACKGROUND_REMOVER="${runpod_endpoint_background_remover}"
    INSTALL_RUNPOD_ENDPOINT_AUDIO_SPLITTER="${runpod_endpoint_audio_splitter}"
    INSTALL_RUNPOD_ENDPOINT_PHOTO_PICKER="${runpod_endpoint_photo_picker}"

    INSTALL_GA4_CLIENT_ID="${ga4_client_id}"
    INSTALL_GA4_CLIENT_SECRET="${ga4_client_secret}"
    INSTALL_GA4_REFRESH_TOKEN="${ga4_refresh_token}"
    INSTALL_GA4_PROPERTY_ID="${ga4_property_id}"
    INSTALL_GOOGLE_ADS_CLIENT_ID="${google_ads_client_id}"
    INSTALL_GOOGLE_ADS_CLIENT_SECRET="${google_ads_client_secret}"
    INSTALL_GOOGLE_ADS_REFRESH_TOKEN="${google_ads_refresh_token}"
    INSTALL_GOOGLE_ADS_DEVELOPER_TOKEN="${google_ads_developer_token}"
    INSTALL_GOOGLE_ADS_CUSTOMER_ID="${google_ads_customer_id}"
    INSTALL_GOOGLE_ADS_LOGIN_CUSTOMER_ID="${google_ads_login_customer_id}"
    INSTALL_GSC_CLIENT_ID="${gsc_client_id}"
    INSTALL_GSC_CLIENT_SECRET="${gsc_client_secret}"
    INSTALL_GSC_REFRESH_TOKEN="${gsc_refresh_token}"
    INSTALL_RESEND_API_KEY="${resend_api_key}"
    INSTALL_MAILCHIMP_API_KEY="${mailchimp_api_key}"
    INSTALL_MAILCHIMP_SERVER_PREFIX="${mailchimp_server_prefix}"
    INSTALL_SENDGRID_API_KEY="${sendgrid_api_key}"
    INSTALL_KIT_API_KEY="${kit_api_key}"
    INSTALL_KIT_API_SECRET="${kit_api_secret}"
    INSTALL_DUB_API_KEY="${dub_api_key}"
    INSTALL_SEMRUSH_API_KEY="${semrush_api_key}"
    INSTALL_AHREFS_API_KEY="${ahrefs_api_key}"
    INSTALL_DATAFORSEO_LOGIN="${dataforseo_login}"
    INSTALL_DATAFORSEO_PASSWORD="${dataforseo_password}"
    INSTALL_KEYWORDS_EVERYWHERE_API_KEY="${keywords_everywhere_api_key}"
    INSTALL_PLAUSIBLE_API_KEY="${plausible_api_key}"
    INSTALL_PLAUSIBLE_SITE_ID="${plausible_site_id}"
    INSTALL_MIXPANEL_SA_USERNAME="${mixpanel_sa_username}"
    INSTALL_MIXPANEL_SECRET="${mixpanel_secret}"
    INSTALL_AMPLITUDE_API_KEY="${amplitude_api_key}"
    INSTALL_AMPLITUDE_SECRET_KEY="${amplitude_secret_key}"
    INSTALL_HOTJAR_SITE_ID="${hotjar_site_id}"
    INSTALL_HOTJAR_API_TOKEN="${hotjar_api_token}"
    INSTALL_OPTIMIZELY_SDK_KEY="${optimizely_sdk_key}"
    INSTALL_OPTIMIZELY_ACCESS_TOKEN="${optimizely_access_token}"
    INSTALL_HUBSPOT_ACCESS_TOKEN="${hubspot_access_token}"
    INSTALL_SALESFORCE_CLIENT_ID="${salesforce_client_id}"
    INSTALL_SALESFORCE_CLIENT_SECRET="${salesforce_client_secret}"
    INSTALL_SALESFORCE_USERNAME="${salesforce_username}"
    INSTALL_SALESFORCE_PASSWORD="${salesforce_password}"
    INSTALL_SALESFORCE_SECURITY_TOKEN="${salesforce_security_token}"
    INSTALL_CLOSE_API_KEY="${close_api_key}"
    INSTALL_OUTREACH_CLIENT_ID="${outreach_client_id}"
    INSTALL_OUTREACH_CLIENT_SECRET="${outreach_client_secret}"
    INSTALL_OUTREACH_REFRESH_TOKEN="${outreach_refresh_token}"
    INSTALL_CROSSBEAM_API_KEY="${crossbeam_api_key}"
    INSTALL_APOLLO_API_KEY="${apollo_api_key}"
    INSTALL_CLEARBIT_API_KEY="${clearbit_api_key}"
    INSTALL_ZOOMINFO_USERNAME="${zoominfo_username}"
    INSTALL_ZOOMINFO_PASSWORD="${zoominfo_password}"
    INSTALL_CLAY_API_KEY="${clay_api_key}"
    INSTALL_SEGMENT_WRITE_KEY="${segment_write_key}"
    INSTALL_FAL_API_KEY="${fal_api_key}"
}

configure_runpod_b2_staging_env() {
    local configure_choice="${ABRA_CONFIGURE_BACKBLAZE_B2_RUNPOD_ENV:-}"
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
                read -r -p "Configure optional Backblaze B2 staging bucket for RunPod GPU inference? [y/N] " reply
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
        echo "  • Skipping optional RunPod B2 staging env setup"
        return 0
    fi

    mkdir -p "$(dirname "${BACKBLAZE_B2_RUNPOD_ENV_FILE}")"

    local existing_key_id existing_app_key existing_bucket_name
    existing_key_id="$(read_env_value "${BACKBLAZE_B2_RUNPOD_ENV_FILE}" "BACKBLAZE_B2_RUNPOD_KEY_ID")"
    existing_app_key="$(read_env_value "${BACKBLAZE_B2_RUNPOD_ENV_FILE}" "BACKBLAZE_B2_RUNPOD_APPLICATION_KEY")"
    existing_bucket_name="$(read_env_value "${BACKBLAZE_B2_RUNPOD_ENV_FILE}" "BACKBLAZE_B2_RUNPOD_BUCKET_NAME")"

    local b2_key_id="${BACKBLAZE_B2_RUNPOD_KEY_ID:-${existing_key_id}}"
    local b2_app_key="${BACKBLAZE_B2_RUNPOD_APPLICATION_KEY:-${existing_app_key}}"
    local b2_bucket_name="${BACKBLAZE_B2_RUNPOD_BUCKET_NAME:-${existing_bucket_name}}"

    if [ -t 0 ]; then
        echo
        echo "Backblaze B2 staging bucket for RunPod GPU inference:"
        echo "  File: ${BACKBLAZE_B2_RUNPOD_ENV_FILE}"
        echo "  Create bucket first: b2 create-bucket runpod-staging allPrivate"
        read -r -p "BACKBLAZE_B2_RUNPOD_KEY_ID [${b2_key_id}]: " reply
        b2_key_id="${reply:-${b2_key_id}}"
        read -r -p "BACKBLAZE_B2_RUNPOD_APPLICATION_KEY [${b2_app_key}]: " reply
        b2_app_key="${reply:-${b2_app_key}}"
        read -r -p "BACKBLAZE_B2_RUNPOD_BUCKET_NAME [${b2_bucket_name:-runpod-staging}]: " reply
        b2_bucket_name="${reply:-${b2_bucket_name}}"
    fi

    cat > "${BACKBLAZE_B2_RUNPOD_ENV_FILE}" <<EOF
# Backblaze B2 staging bucket for RunPod GPU inference file transfer.
# Stored next to openclaw.json and referenced via env.BACKBLAZE_B2_RUNPOD_ENV_FILE.
# Create bucket: b2 create-bucket runpod-staging allPrivate
BACKBLAZE_B2_RUNPOD_KEY_ID="$(escape_env_value "${b2_key_id}")"
BACKBLAZE_B2_RUNPOD_APPLICATION_KEY="$(escape_env_value "${b2_app_key}")"
BACKBLAZE_B2_RUNPOD_BUCKET_NAME="$(escape_env_value "${b2_bucket_name}")"
EOF

    echo "  ✓ RunPod B2 staging env file: ${BACKBLAZE_B2_RUNPOD_ENV_FILE}"
    echo "    openclaw.json env.BACKBLAZE_B2_RUNPOD_ENV_FILE -> ${BACKBLAZE_B2_RUNPOD_ENV_FILE_CONTAINER}"
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

parse_args "$@"

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

# Select which skills to enable before any processing
select_enabled_skills

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

    # Check if this skill should be copied based on enablement
    local skip_skill=1
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

    copy_directory_clean "${skill_dir}" "${SKILLS_DEST}/${skill_name}"
    echo "  + ${skill_name}"
done
[ -n "${TEMP_CLONE}" ] && rm -rf "${TEMP_CLONE}"

configure_post_scheduler_env
configure_runpod_b2_staging_env
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
jq --arg path "${BACKBLAZE_B2_RUNPOD_ENV_FILE_CONTAINER}" '.env.BACKBLAZE_B2_RUNPOD_ENV_FILE = $path' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"

[ "${SKILL_ENABLED_POST_SCHEDULER}" = "1" ] && set_config_env_value "BUFFER_API_KEY" "${INSTALL_BUFFER_API_KEY}"
[ "${SKILL_ENABLED_GIPHY}" = "1" ] && set_config_env_value "GIPHY_API_KEY" "${INSTALL_GIPHY_API_KEY}"
[ "${SKILL_ENABLED_FREESOUND}" = "1" ] && set_config_env_value "FREESOUND_API_KEY" "${INSTALL_FREESOUND_API_KEY}"
[ "${SKILL_ENABLED_PIXABAY}" = "1" ] && set_config_env_value "PIXABAY_API_KEY" "${INSTALL_PIXABAY_API_KEY}"
[ "${SKILL_ENABLED_ML_MODELS}" = "1" ] && set_config_env_value "HF_TOKEN" "${INSTALL_HF_TOKEN}"
[ "${SKILL_ENABLED_ML_MODELS}" = "1" ] && set_config_env_value "REPLICATE_API_TOKEN" "${INSTALL_REPLICATE_API_TOKEN}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_API_KEY" "${INSTALL_RUNPOD_API_KEY}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR" "${INSTALL_RUNPOD_ENDPOINT_VIDEO_EDITOR}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_VIDEO_MATTE" "${INSTALL_RUNPOD_ENDPOINT_VIDEO_MATTE}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR" "${INSTALL_RUNPOD_ENDPOINT_FRAME_INTERPOLATOR}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_BOKEH_EFFECT" "${INSTALL_RUNPOD_ENDPOINT_BOKEH_EFFECT}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER" "${INSTALL_RUNPOD_ENDPOINT_BACKGROUND_REMOVER}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER" "${INSTALL_RUNPOD_ENDPOINT_AUDIO_SPLITTER}"
[ "${SKILL_ENABLED_RUNPOD_GPU}" = "1" ] && set_config_env_value "RUNPOD_ENDPOINT_ID_PHOTO_PICKER" "${INSTALL_RUNPOD_ENDPOINT_PHOTO_PICKER}"

if [ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] || [ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ]; then
    set_config_env_value "GA4_CLIENT_ID" "${INSTALL_GA4_CLIENT_ID}"
    set_config_env_value "GA4_CLIENT_SECRET" "${INSTALL_GA4_CLIENT_SECRET}"
    set_config_env_value "GA4_REFRESH_TOKEN" "${INSTALL_GA4_REFRESH_TOKEN}"
    set_config_env_value "GA4_PROPERTY_ID" "${INSTALL_GA4_PROPERTY_ID}"
fi

[ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && set_config_env_value "GOOGLE_ADS_CLIENT_ID" "${INSTALL_GOOGLE_ADS_CLIENT_ID}"
[ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && set_config_env_value "GOOGLE_ADS_CLIENT_SECRET" "${INSTALL_GOOGLE_ADS_CLIENT_SECRET}"
[ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && set_config_env_value "GOOGLE_ADS_REFRESH_TOKEN" "${INSTALL_GOOGLE_ADS_REFRESH_TOKEN}"
[ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && set_config_env_value "GOOGLE_ADS_DEVELOPER_TOKEN" "${INSTALL_GOOGLE_ADS_DEVELOPER_TOKEN}"
[ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && set_config_env_value "GOOGLE_ADS_CUSTOMER_ID" "${INSTALL_GOOGLE_ADS_CUSTOMER_ID}"
[ "${SKILL_ENABLED_ADS_MANAGER}" = "1" ] && set_config_env_value "GOOGLE_ADS_LOGIN_CUSTOMER_ID" "${INSTALL_GOOGLE_ADS_LOGIN_CUSTOMER_ID}"

[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "GSC_CLIENT_ID" "${INSTALL_GSC_CLIENT_ID}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "GSC_CLIENT_SECRET" "${INSTALL_GSC_CLIENT_SECRET}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "GSC_REFRESH_TOKEN" "${INSTALL_GSC_REFRESH_TOKEN}"

[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "RESEND_API_KEY" "${INSTALL_RESEND_API_KEY}"
[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "MAILCHIMP_API_KEY" "${INSTALL_MAILCHIMP_API_KEY}"
[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "MAILCHIMP_SERVER_PREFIX" "${INSTALL_MAILCHIMP_SERVER_PREFIX}"
[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "SENDGRID_API_KEY" "${INSTALL_SENDGRID_API_KEY}"
[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "KIT_API_KEY" "${INSTALL_KIT_API_KEY}"
[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "KIT_API_SECRET" "${INSTALL_KIT_API_SECRET}"
[ "${SKILL_ENABLED_EMAIL_CAMPAIGNER}" = "1" ] && set_config_env_value "DUB_API_KEY" "${INSTALL_DUB_API_KEY}"

[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "SEMRUSH_API_KEY" "${INSTALL_SEMRUSH_API_KEY}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "AHREFS_API_KEY" "${INSTALL_AHREFS_API_KEY}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "DATAFORSEO_LOGIN" "${INSTALL_DATAFORSEO_LOGIN}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "DATAFORSEO_PASSWORD" "${INSTALL_DATAFORSEO_PASSWORD}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "KEYWORDS_EVERYWHERE_API_KEY" "${INSTALL_KEYWORDS_EVERYWHERE_API_KEY}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "PLAUSIBLE_API_KEY" "${INSTALL_PLAUSIBLE_API_KEY}"
[ "${SKILL_ENABLED_SEO_RESEARCHER}" = "1" ] && set_config_env_value "PLAUSIBLE_SITE_ID" "${INSTALL_PLAUSIBLE_SITE_ID}"

[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "MIXPANEL_SA_USERNAME" "${INSTALL_MIXPANEL_SA_USERNAME}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "MIXPANEL_SECRET" "${INSTALL_MIXPANEL_SECRET}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "AMPLITUDE_API_KEY" "${INSTALL_AMPLITUDE_API_KEY}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "AMPLITUDE_SECRET_KEY" "${INSTALL_AMPLITUDE_SECRET_KEY}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "HOTJAR_SITE_ID" "${INSTALL_HOTJAR_SITE_ID}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "HOTJAR_API_TOKEN" "${INSTALL_HOTJAR_API_TOKEN}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "OPTIMIZELY_SDK_KEY" "${INSTALL_OPTIMIZELY_SDK_KEY}"
[ "${SKILL_ENABLED_FUNNEL_OPTIMIZER}" = "1" ] && set_config_env_value "OPTIMIZELY_ACCESS_TOKEN" "${INSTALL_OPTIMIZELY_ACCESS_TOKEN}"

[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "HUBSPOT_ACCESS_TOKEN" "${INSTALL_HUBSPOT_ACCESS_TOKEN}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "SALESFORCE_CLIENT_ID" "${INSTALL_SALESFORCE_CLIENT_ID}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "SALESFORCE_CLIENT_SECRET" "${INSTALL_SALESFORCE_CLIENT_SECRET}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "SALESFORCE_USERNAME" "${INSTALL_SALESFORCE_USERNAME}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "SALESFORCE_PASSWORD" "${INSTALL_SALESFORCE_PASSWORD}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "SALESFORCE_SECURITY_TOKEN" "${INSTALL_SALESFORCE_SECURITY_TOKEN}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "CLOSE_API_KEY" "${INSTALL_CLOSE_API_KEY}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "OUTREACH_CLIENT_ID" "${INSTALL_OUTREACH_CLIENT_ID}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "OUTREACH_CLIENT_SECRET" "${INSTALL_OUTREACH_CLIENT_SECRET}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "OUTREACH_REFRESH_TOKEN" "${INSTALL_OUTREACH_REFRESH_TOKEN}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "CROSSBEAM_API_KEY" "${INSTALL_CROSSBEAM_API_KEY}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "APOLLO_API_KEY" "${INSTALL_APOLLO_API_KEY}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "CLEARBIT_API_KEY" "${INSTALL_CLEARBIT_API_KEY}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "ZOOMINFO_USERNAME" "${INSTALL_ZOOMINFO_USERNAME}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "ZOOMINFO_PASSWORD" "${INSTALL_ZOOMINFO_PASSWORD}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "CLAY_API_KEY" "${INSTALL_CLAY_API_KEY}"
[ "${SKILL_ENABLED_REVENUE_MANAGER}" = "1" ] && set_config_env_value "SEGMENT_WRITE_KEY" "${INSTALL_SEGMENT_WRITE_KEY}"

[ "${SKILL_ENABLED_ANIMATE_IMAGE}" = "1" ] && set_config_env_value "FAL_API_KEY" "${INSTALL_FAL_API_KEY}"

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
