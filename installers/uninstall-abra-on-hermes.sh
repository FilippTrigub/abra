#!/bin/bash
set -e

PROFILE_NAME="${PROFILE_NAME:-abra}"

if [ -n "${SUDO_USER:-}" ]; then
    REAL_HOME="$(getent passwd "${SUDO_USER}" | cut -d: -f6)"
else
    REAL_HOME="${HOME}"
fi

HOST_HERMES_ROOT="${REAL_HOME}/.hermes"
HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"

usage() {
    cat <<EOF
Usage: $0 [--profile NAME]

Options:
  -p, --profile NAME    Hermes profile name to uninstall (default: abra)
  -h, --help            Show this help message
EOF
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -p|--profile)
                if [ "$#" -lt 2 ]; then
                    echo "Error: $1 requires a name" >&2
                    usage >&2
                    exit 1
                fi
                PROFILE_NAME="$2"
                HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"
                shift 2
                ;;
            --profile=*)
                PROFILE_NAME="${1#*=}"
                HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"
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

echo "Uninstalling Abra Hermes profile '${PROFILE_NAME}'..."
echo

parse_args "$@"

HOST_PROFILE_DIR="${HOST_HERMES_ROOT}/profiles/${PROFILE_NAME}"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^hermes-abra$'; then
    echo "Warning: container 'hermes-abra' is running and may still be using ${HOST_PROFILE_DIR}." >&2
    echo "Stop it first: docker compose -f docker-compose.hermes.yml down" >&2
    if [ -t 0 ]; then
        read -r -p "Continue anyway? [y/N] " reply
        case "${reply}" in y|Y) ;; *) exit 1 ;; esac
    else
        echo "Non-interactive: aborting. Set HERMES_FORCE_UNINSTALL=1 to skip this check." >&2
        [ "${HERMES_FORCE_UNINSTALL:-0}" = "1" ] || exit 1
    fi
fi

if [ ! -d "${HOST_PROFILE_DIR}" ]; then
    echo "Nothing to remove: ${HOST_PROFILE_DIR} does not exist."
    exit 0
fi

rm -rf "${HOST_PROFILE_DIR}"

echo "Removed Hermes profile: ${HOST_PROFILE_DIR}"
echo "Done."
