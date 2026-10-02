#!/usr/bin/env bash
# Upload everything in public/ to the Supabase Storage bucket served to the frontend.
#
# Usage:  SUPABASE_SERVICE_KEY=... ./scripts/upload-assets.sh
# Env:    SUPABASE_URL (default: project URL), ASSETS_BUCKET (default: portal-assets)
#
# Files keep their path relative to public/ (public/assets/xlsx.png -> assets/xlsx.png)
# and existing objects are overwritten.
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-https://awcoxytlmjiyfmpzinam.supabase.co}"
BUCKET="${ASSETS_BUCKET:-portal-assets}"
: "${SUPABASE_SERVICE_KEY:?SUPABASE_SERVICE_KEY is required}"

cd "$(dirname "$0")/../public"

content_type() {
  case "${1##*.}" in
    png) echo image/png ;;
    jpg|jpeg) echo image/jpeg ;;
    svg) echo image/svg+xml ;;
    webp) echo image/webp ;;
    ico) echo image/x-icon ;;
    *) echo application/octet-stream ;;
  esac
}

failed=0
while IFS= read -r -d '' file; do
  path="${file#./}"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$SUPABASE_URL/storage/v1/object/$BUCKET/$path" \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: $(content_type "$path")" \
    -H "Cache-Control: max-age=86400" \
    -H "x-upsert: true" \
    --data-binary "@$file")
  echo "$code  $path"
  [ "$code" = "200" ] || failed=1
done < <(find . -type f -print0 | sort -z)

echo "Public URL base: $SUPABASE_URL/storage/v1/object/public/$BUCKET"
exit "$failed"
