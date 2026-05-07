#!/usr/bin/env bash
set -euo pipefail

export SCRAPER_HEADLESS="${SCRAPER_HEADLESS:-false}"
export DISPLAY="${DISPLAY:-:99}"

if [[ "${SCRAPER_HEADLESS}" != "false" ]]; then
  echo "RentalRadar browser workers must run headed Chrome: set SCRAPER_HEADLESS=false" >&2
  exit 64
fi

XVFB_WHD="${XVFB_WHD:-1920x1080x24}"
XVFB_ARGS="-screen 0 ${XVFB_WHD} -ac +extension RANDR +render -noreset"

exec xvfb-run \
  --auto-servernum \
  --server-args="${XVFB_ARGS}" \
  "$@"
