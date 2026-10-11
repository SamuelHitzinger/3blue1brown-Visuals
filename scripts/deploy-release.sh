#!/usr/bin/env bash
# Run over SSH as deploy. --check never stops or replaces production.
set -Eeuo pipefail
archive=$(realpath -- "${1:?Usage: deploy-release.sh ARCHIVE COMMIT_SHA [--check]}")
revision=${2:?Usage: deploy-release.sh ARCHIVE COMMIT_SHA [--check]}
mode=${3:-deploy}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA' >&2; exit 1; }
[[ "$mode" == deploy || "$mode" == --check ]] || { echo 'Unknown deployment mode' >&2; exit 1; }
[[ $(id -un) == deploy ]] || { echo 'Run this script as deploy' >&2; exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo 'This release requires Linux x86_64' >&2; exit 1; }
sudo -n docker info >/dev/null
sudo -n docker compose version --short | python3 -c 'import re,sys; v=tuple(map(int,re.findall(r"\d+",sys.stdin.read())[:3])); assert v >= (2,30,0), "Docker Compose >=2.30.0 is required"'
[[ $(systemctl is-enabled docker) == enabled ]] || { echo 'Enable Docker at boot before deployment' >&2; exit 1; }
base=/srv/apps/3yellow3white-actions
service=3yellow3white
project=3yellow3white
health_url=http://127.0.0.1:8080/healthz
mkdir -p "$base/releases"
exec 9>"$base/deploy.lock"
flock -w 120 9
release=$(mktemp -d "$base/releases/$revision.docker.XXXXXX")
previous=$(readlink -e "$base/docker-current" || true)
previous_revision=
activated=false
complete=false
legacy_active=false
legacy_enabled=false
legacy_revision=
if systemctl is-active --quiet "$service"; then legacy_active=true; fi
if [[ $(systemctl is-enabled "$service" 2>/dev/null || true) == enabled ]]; then legacy_enabled=true; fi
compose() {
  sudo -n docker compose --project-name "$project" --env-file "$1/compose.env" --file "$1/compose.yaml" "${@:2}"
}
wait_health() {
  local expected=$1 attempt
  for ((attempt=0; attempt<30; attempt++)); do
    if curl --fail --silent --max-time 2 "$health_url" | \
      python3 -c 'import json,sys; h=json.load(sys.stdin); assert h.get("ok") is True and (not sys.argv[1] or h.get("revision")==sys.argv[1])' "$expected" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}
cleanup() {
  local result=$? restored=true expected
  trap - EXIT
  if [[ "$activated" == true && "$complete" != true ]]; then
    echo 'New container failed; restoring the previous deployment.' >&2
    compose "$release" logs --tail 80 || true
    if ! compose "$release" down --timeout 30; then
      restored=false
      # The candidate may still restart at boot; keep legacy from competing then.
      if [[ "$legacy_enabled" == true ]]; then sudo -n systemctl disable "$service" || true; fi
    fi
    # Never start another writer unless the candidate was fully removed.
    if [[ "$restored" == true && -n "$previous" ]]; then
      if ! compose "$previous" up --detach --wait --wait-timeout 60; then restored=false; fi
    fi
    if [[ "$restored" == true && "$legacy_enabled" == true ]]; then
      if ! sudo -n systemctl enable "$service"; then restored=false; fi
    fi
    if [[ "$restored" == true && "$legacy_active" == true ]]; then
      if ! sudo -n systemctl start "$service"; then restored=false; fi
    fi
    if [[ "$restored" == true && ( -n "$previous" || "$legacy_active" == true ) ]]; then
      expected=$legacy_revision
      if [[ -n "$previous" ]]; then expected=$previous_revision; fi
      if ! wait_health "$expected"; then restored=false; fi
    fi
    if [[ "$restored" != true ]]; then
      echo "ROLLBACK FAILED. Retaining recovery files at $release" >&2
      result=1
    fi
  fi
  if [[ "$complete" != true && "$restored" == true ]]; then rm -rf -- "$release"; fi
  exit "$result"
}
trap cleanup EXIT
if [[ -n "$previous" ]]; then
  [[ "$previous" == "$base/releases/"* && -f "$previous/compose.env" && -f "$previous/compose.yaml" ]]
  previous_revision=$(cat "$previous/REVISION")
  [[ "$previous_revision" =~ ^[0-9a-f]{40}$ ]]
  [[ "$legacy_active" != true ]] || { echo 'Both Docker and legacy service are active; resolve before deployment' >&2; exit 1; }
else
  [[ -z $(sudo -n docker ps -aq --filter "label=com.docker.compose.project=$project") ]] || {
    echo 'Found unmanaged production Compose containers without docker-current; resolve before deployment' >&2; exit 1;
  }
fi
# Extract only the small recovery files. Keeping a second copy of the saved
# image alongside the upload and Docker's layers can fill the VM's disk.
tar --extract --gzip --file "$archive" --directory "$release" --no-same-owner \
  --exclude='./image.tar.gz' --exclude='image.tar.gz'
[[ $(cat "$release/REVISION") == "$revision" ]] || { echo 'Archive revision mismatch' >&2; exit 1; }
image_tag=$(cat "$release/IMAGE_TAG")
[[ "$image_tag" == "3yellow3white:$revision" ]] || { echo 'Invalid image tag' >&2; exit 1; }
# Both spellings occur in release archives; pipefail rejects a missing or
# truncated image before any candidate validation or production activation.
tar --extract --gzip --file "$archive" --to-stdout --wildcards --no-anchored 'image.tar.gz' \
  | sudo -n docker image load
# Resolve on the VM: image IDs can differ between classic and containerd stores.
image_id=$(sudo -n docker image inspect --format '{{.Id}}' "$image_tag")
[[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ $(sudo -n docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id") == "$revision" ]]
# All candidate jobs and narration writes use temporary, isolated directories.
bash "$release/scripts/smoke-container.sh" "$image_id" "$revision"
python3 "$release/scripts/container-config.py" "$release" "$base" "$revision" "$image_id" "${archive%/*}/deployment.env"
compose "$release" config --quiet
if [[ "$mode" == --check ]]; then
  echo 'Container lifecycle verified; production was not changed.'
  exit 0
fi
mapfile -t directories < <(python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); print(p["video"]); print(p["narration"]); print(p["agents"])' "$release/paths.json")
[[ ${#directories[@]} == 3 ]]
for directory in "${directories[@]}"; do
  if [[ ! -d "$directory" ]]; then
    sudo -n install -d -o deploy -g deploy -m 700 "$directory"
  fi
  [[ -w "$directory" && -x "$directory" ]] || { echo "deploy cannot write $directory" >&2; exit 1; }
done
if [[ -n "$previous" ]]; then ln -s "$previous" "$release/previous-docker"; fi
if sudo -n test -f "/etc/systemd/system/$service.service"; then
  # Redirect as deploy: the saved recovery file must be owned by deploy.
  # shellcheck disable=SC2024
  sudo -n cat "/etc/systemd/system/$service.service" > "$release/previous.service"
fi
printf '%s\n' "$legacy_active" > "$release/legacy-active"
printf '%s\n' "$legacy_enabled" > "$release/legacy-enabled"
if [[ "$legacy_active" == true ]]; then
  legacy_revision=$(curl --fail --silent --show-error --max-time 5 "$health_url" | python3 -c 'import json,sys; h=json.load(sys.stdin); assert h.get("ok") is True; print(h.get("revision", ""))')
fi
activated=true
# Stop the single writer before giving the container the persistent database.
if [[ "$legacy_active" == true ]]; then sudo -n systemctl stop "$service"; fi
compose "$release" up --detach --wait --wait-timeout 60
curl --fail --silent --show-error --max-time 5 "$health_url" | \
  python3 -c 'import json,sys; h=json.load(sys.stdin); assert h.get("ok") is True and h.get("revision")==sys.argv[1]' "$revision"
# Docker's restart policy now owns reboot recovery. Leave the old unit for rollback.
if [[ "$legacy_enabled" == true ]]; then sudo -n systemctl disable "$service"; fi
ln -sfn "$release" "$base/docker-current.next"
mv -Tf "$base/docker-current.next" "$base/docker-current"
complete=true
printf 'Deployed and verified Docker revision %s\n' "$revision"
