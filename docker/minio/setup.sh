#!/bin/sh
# Bootstraps the local MinIO deployment for nest-storage-example.
#
# Registers a deployment alias, creates the three demo buckets, enables object
# versioning on the versioned bucket, and seeds a handful of sample objects
# across the avatars/, invoices/, and attachments/ prefixes so the vault
# renders on the first application boot. The script is idempotent: bucket
# creation ignores existing buckets, versioning is re-enabled as a no-op, and
# seed objects are overwritten in place, so it is safe to re-run.
set -eu

ALIAS='local'
ENDPOINT='http://minio:9000'
ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"

DEFAULT_BUCKET='vault'
ARCHIVE_BUCKET='vault-archive'
VERSIONED_BUCKET='vault-versioned'

# A 1x1 transparent PNG, generated inline so no binary fixtures live in git.
PNG_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

# Streams a text object to the target key with an explicit content type.
seed_text() {
  target="$1"
  content_type="$2"
  body="$3"
  printf '%s' "$body" | mc pipe --attr "Content-Type=${content_type}" "$target"
}

# Streams the inline 1x1 PNG to the target key as an image object.
seed_png() {
  target="$1"
  printf '%s' "$PNG_BASE64" | base64 -d | mc pipe --attr 'Content-Type=image/png' "$target"
}

# Register the deployment alias (overwrites any stale entry from a prior run).
mc alias set "$ALIAS" "$ENDPOINT" "$ROOT_USER" "$ROOT_PASSWORD"

# Create the demo buckets; --ignore-existing keeps re-runs idempotent.
mc mb --ignore-existing "$ALIAS/$DEFAULT_BUCKET"
mc mb --ignore-existing "$ALIAS/$ARCHIVE_BUCKET"
mc mb --ignore-existing "$ALIAS/$VERSIONED_BUCKET"

# Enable versioning on the versioned bucket (re-enabling is a no-op).
mc version enable "$ALIAS/$VERSIONED_BUCKET"

# Seed sample objects across the three navigation prefixes (ten in total).
seed_png "$ALIAS/$DEFAULT_BUCKET/avatars/ada.png"
seed_png "$ALIAS/$DEFAULT_BUCKET/avatars/grace.png"
seed_png "$ALIAS/$DEFAULT_BUCKET/avatars/linus.png"

seed_text "$ALIAS/$DEFAULT_BUCKET/invoices/invoice-2026-001.txt" 'text/plain' \
  'Invoice 2026-001 - sample seed object for the vault listing demo.'
seed_text "$ALIAS/$DEFAULT_BUCKET/invoices/invoice-2026-002.txt" 'text/plain' \
  'Invoice 2026-002 - sample seed object for the vault listing demo.'
seed_text "$ALIAS/$DEFAULT_BUCKET/invoices/invoice-2026-003.txt" 'text/plain' \
  'Invoice 2026-003 - sample seed object for the vault listing demo.'
seed_text "$ALIAS/$DEFAULT_BUCKET/invoices/invoice-2026-004.txt" 'text/plain' \
  'Invoice 2026-004 - sample seed object for the vault listing demo.'

seed_text "$ALIAS/$DEFAULT_BUCKET/attachments/readme.txt" 'text/plain' \
  'Attachment readme - sample seed object for the vault listing demo.'
seed_text "$ALIAS/$DEFAULT_BUCKET/attachments/notes.md" 'text/markdown' \
  '# Attachment notes

Sample seed object for the vault listing demo.'
seed_text "$ALIAS/$DEFAULT_BUCKET/attachments/report.txt" 'text/plain' \
  'Attachment report - sample seed object for the vault listing demo.'

# Print a summary of the provisioned topology for the run logs.
echo 'MinIO bootstrap complete. Buckets:'
mc ls "$ALIAS"
echo "Versioning on ${VERSIONED_BUCKET}:"
mc version info "$ALIAS/$VERSIONED_BUCKET"
echo "Seed objects under ${DEFAULT_BUCKET}:"
mc ls --recursive "$ALIAS/$DEFAULT_BUCKET"
