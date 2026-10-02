#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
client_dir="$repo_root/client"
public_dir="$repo_root/server/public"
deployment_zip="$repo_root/deployment.zip"

npm ci --prefix "$client_dir"
VITE_API_URL=/api VITE_API_TIMEOUT_MS=60000 npm run build --prefix "$client_dir"

rm -rf "$public_dir"
mkdir -p "$public_dir"
cp -a "$client_dir/dist/." "$public_dir/"

command -v zip >/dev/null || {
  printf 'zip is required to create deployment.zip\n' >&2
  exit 1
}

rm -f "$deployment_zip"
(
  cd "$repo_root/server"
  zip -qr "$deployment_zip" \
    package.json package-lock.json server.js app.js constants.js \
    config controllers data middleware models routes services utils public
)

printf 'Azure deployment package created at %s\n' "$deployment_zip"