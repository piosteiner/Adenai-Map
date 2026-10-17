#!/bin/bash
# Restore the off-site backup made by scripts/backup.sh into a target directory (default: ./adenai-restore).
#   scripts/restore-backup.sh [target]   → target/uploads/optimized/*.webp, target/config/users.js, target/.env
# Needs the backup repo (git clone git@github-adenai-backups:piosteiner/adenai-backups.git ~/backups/adenai-offsite)
# and the passphrase in ~/.config/adenai/backup-passphrase. Copy the restored files into server/ yourself.
set -euo pipefail
umask 077
OFFSITE="$HOME/backups/adenai-offsite"
PASSPHRASE_FILE="$HOME/.config/adenai/backup-passphrase"
TARGET="${1:-./adenai-restore}"

decrypt() { gpg --quiet --batch --yes --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" --decrypt --output "$2" "$1"; }

install -d "$TARGET/uploads/optimized" "$TARGET/config"
n=0
for f in "$OFFSITE"/media/*.gpg; do
  [ -e "$f" ] || continue
  decrypt "$f" "$TARGET/uploads/optimized/$(basename "$f" .gpg)"
  n=$((n + 1))
done
[ -f "$OFFSITE/server/config_users.js.gpg" ] && decrypt "$OFFSITE/server/config_users.js.gpg" "$TARGET/config/users.js"
[ -f "$OFFSITE/server/.env.gpg" ] && decrypt "$OFFSITE/server/.env.gpg" "$TARGET/.env"
echo "restored $n media files and the server files into $TARGET"
