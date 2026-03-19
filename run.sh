#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEFAULT_SCRIPT="projs/Fitness-proj/demo-short.render.md"

usage() {
  cat <<'EOF'
Usage:
  bash run.sh [action] [script-or-project] [options]

Actions:
  render       Render a script with its default/frontmatter model
  fast         Render with veo-3.1-fast-generate-preview
  dry-run      Build prompts/plan/manifest only, without calling the API
  plan         Parse and validate the script, then print the plan
  stitch       Stitch an existing manifest
  typecheck    Run TypeScript typecheck
  help         Show this help

Defaults:
  action: render
  script: projs/Fitness-proj/demo-short.render.md

Examples:
  bash run.sh
  bash run.sh fast
  bash run.sh plan
  bash run.sh render projs/Fitness-proj/demo-short.render.md --output outputs/my-run
  bash run.sh fast projs/Fitness-proj/demo-short.render.part3.md
  bash run.sh render drawio-proj --shot last
  bash run.sh plan projs/examples/demo-short.md
  bash run.sh stitch --manifest outputs/some-run/manifest.json

Options:
  -s, --script <path>                 Explicit script path
  -m, --model <name>                  Override model
  -o, --output <path>                 Explicit output run directory or stitched video path
  --shot <selector>                   Limit to specific shots by global index, shot id, or 'last' (repeatable)
  --manifest <path>                   Manifest path for stitch
  --poll-ms <ms>                      Polling interval for long-running video operations
  --inter-shot-delay-ms <ms>          Delay between clip submissions
  -h, --help                          Show help
EOF
}

ensure_env_loaded() {
  if [[ -f ".env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
  fi
}

ensure_dependencies() {
  if [[ ! -d "node_modules" ]]; then
    echo "node_modules is missing. Run: npm install --cache .npm-cache" >&2
    exit 1
  fi
}

resolve_script() {
  local input="$1"
  local candidate=""

  if [[ -z "$input" ]]; then
    echo "$DEFAULT_SCRIPT"
    return
  fi

  if [[ -e "$input" ]]; then
    candidate="$input"
  elif [[ -e "projs/$input" ]]; then
    candidate="projs/$input"
  else
    candidate="$input"
  fi

  if [[ -d "$candidate" ]]; then
    if [[ -f "$candidate/demo-short.render.md" ]]; then
      echo "$candidate/demo-short.render.md"
      return
    fi
    if [[ -f "$candidate/demo-short.md" ]]; then
      echo "$candidate/demo-short.md"
      return
    fi
  fi

  echo "$candidate"
}

ACTION="render"
SCRIPT_ARG=""
MODEL=""
OUTPUT=""
MANIFEST=""
POLL_MS=""
INTER_SHOT_DELAY_MS=""
SHOT_SELECTORS=()

if [[ $# -gt 0 ]]; then
  case "$1" in
    render|fast|dry-run|plan|stitch|typecheck|help|-h|--help)
      ACTION="$1"
      shift
      ;;
  esac
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--script)
      SCRIPT_ARG="$2"
      shift 2
      ;;
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    --shot)
      SHOT_SELECTORS+=("$2")
      shift 2
      ;;
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --poll-ms)
      POLL_MS="$2"
      shift 2
      ;;
    --inter-shot-delay-ms)
      INTER_SHOT_DELAY_MS="$2"
      shift 2
      ;;
    -h|--help)
      ACTION="help"
      shift
      ;;
    *)
      if [[ -z "$SCRIPT_ARG" && "$ACTION" != "stitch" && "$ACTION" != "typecheck" ]]; then
        SCRIPT_ARG="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ "$ACTION" == "help" ]]; then
  usage
  exit 0
fi

ensure_dependencies
ensure_env_loaded

SCRIPT_PATH="$(resolve_script "$SCRIPT_ARG")"

case "$ACTION" in
  typecheck)
    exec npm run typecheck
    ;;
  plan)
    cmd=(npm run plan -- --script "$SCRIPT_PATH")
    [[ -n "$OUTPUT" ]] && cmd+=("--output" "$OUTPUT")
    [[ -n "$MODEL" ]] && cmd+=("--model" "$MODEL")
    if ((${#SHOT_SELECTORS[@]})); then
      for shot_selector in "${SHOT_SELECTORS[@]}"; do
        cmd+=("--shot" "$shot_selector")
      done
    fi
    printf 'Running:'
    printf ' %q' "${cmd[@]}"
    printf '\n'
    exec "${cmd[@]}"
    ;;
  dry-run|render|fast)
    if [[ "$ACTION" == "fast" && -z "$MODEL" ]]; then
      MODEL="veo-3.1-fast-generate-preview"
    fi

    if [[ "$ACTION" != "dry-run" && -z "${GEMINI_API_KEY:-}" ]]; then
      echo "GEMINI_API_KEY is not set. Put it in .env or export it before running." >&2
      exit 1
    fi

    cmd=(npm run render -- --script "$SCRIPT_PATH")
    [[ -n "$OUTPUT" ]] && cmd+=("--output" "$OUTPUT")
    [[ -n "$MODEL" ]] && cmd+=("--model" "$MODEL")
    if ((${#SHOT_SELECTORS[@]})); then
      for shot_selector in "${SHOT_SELECTORS[@]}"; do
        cmd+=("--shot" "$shot_selector")
      done
    fi
    [[ -n "$POLL_MS" ]] && cmd+=("--poll-ms" "$POLL_MS")
    [[ -n "$INTER_SHOT_DELAY_MS" ]] && cmd+=("--inter-shot-delay-ms" "$INTER_SHOT_DELAY_MS")
    [[ "$ACTION" == "dry-run" ]] && cmd+=("--dry-run")
    printf 'Running:'
    printf ' %q' "${cmd[@]}"
    printf '\n'
    exec "${cmd[@]}"
    ;;
  stitch)
    if [[ -z "$MANIFEST" ]]; then
      echo "--manifest is required for stitch." >&2
      exit 1
    fi
    cmd=(npm run dev -- stitch --manifest "$MANIFEST")
    [[ -n "$OUTPUT" ]] && cmd+=("--output" "$OUTPUT")
    printf 'Running:'
    printf ' %q' "${cmd[@]}"
    printf '\n'
    exec "${cmd[@]}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
