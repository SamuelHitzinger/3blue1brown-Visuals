#!/usr/bin/env bash
set -Eeuo pipefail
revision=${1:?Usage: package-release.sh COMMIT_SHA OUTPUT_DIRECTORY}
output=${2:?Usage: package-release.sh COMMIT_SHA OUTPUT_DIRECTORY}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA' >&2; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p -- "$output"
output=$(cd -- "$output" && pwd)
cd -- "$root"
image="3yellow3white:$revision"
docker build --platform linux/amd64 --build-arg "APP_REVISION=$revision" --tag "$image" .
bash scripts/smoke-container.sh "$image" "$revision"
staging=$(mktemp -d)
trap 'rm -rf -- "$staging"' EXIT
cp compose.yaml "$staging/"
mkdir "$staging/scripts"
cp scripts/smoke-container.sh scripts/check-container-http.py scripts/container-config.py scripts/cleanup-images.py "$staging/scripts/"
printf '%s\n' "$revision" > "$staging/REVISION"
printf '%s\n' "$image" > "$staging/IMAGE_TAG"
docker image save "$image" | gzip -1 > "$staging/image.tar.gz"
tar -czf "$output/release.tar.gz" -C "$staging" .
(cd "$output" && sha256sum release.tar.gz > release.sha256)
printf 'Packaged and tested Docker image %s\n' "$image"
