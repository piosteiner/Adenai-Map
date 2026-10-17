#!/bin/bash
# Nightly off-site backup of what exists only on this server (systemd: adenai-backup.timer). Manual run: scripts/backup.sh
#   - uploads/optimized/*.webp (the media; their names never change): each file encrypted once, on its first night
#   - config/users.js (CMS accounts) and .env (tokens, secrets): encrypted again whenever they change
# The location, character, media-library and journey data are in the public repo (public/data) and need no backup here.
# Target: the private GitHub repo cloned at ~/backups/adenai-offsite (SSH alias github-adenai-backups); its git history
# keeps every version. Encryption: gpg AES256 with ~/.config/adenai/backup-passphrase — keep a copy of it elsewhere,
# without it the backup can't be read. Restore: scripts/restore-backup.sh.
set -euo pipefail
umask 077
SERVER="$(cd "$(dirname "$0")/.." && pwd)"
OFFSITE="$HOME/backups/adenai-offsite"
PASSPHRASE_FILE="$HOME/.config/adenai/backup-passphrase"

[ -d "$OFFSITE/.git" ] || { echo "✗ off-site repo missing at $OFFSITE"; exit 1; }
[ -s "$PASSPHRASE_FILE" ] || { echo "✗ passphrase missing at $PASSPHRASE_FILE"; exit 1; }
git -C "$OFFSITE" pull --quiet --rebase 2>/dev/null || true

encrypt() { # source → target.gpg
  gpg --quiet --batch --yes --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" \
      --symmetric --cipher-algo AES256 --output "$2" "$1"
}

# Media: new files only (a file once backed up never changes)
install -d "$OFFSITE/media"
new=0
for f in "$SERVER"/uploads/optimized/*.webp; do
  [ -e "$f" ] || continue
  target="$OFFSITE/media/$(basename "$f").gpg"
  [ -e "$target" ] && continue
  encrypt "$f" "$target"
  new=$((new + 1))
done

# Secrets and accounts: only when their content changed (gpg output differs every run, so compare hashes)
install -d "$OFFSITE/server"
changed=0
for rel in config/users.js .env; do
  src="$SERVER/$rel"
  [ -f "$src" ] || continue
  name="$(echo "$rel" | tr '/' '_')"
  hash=$(sha256sum "$src" | cut -d' ' -f1)
  if [ "$hash" != "$(cat "$OFFSITE/server/$name.sha256" 2>/dev/null)" ]; then
    encrypt "$src" "$OFFSITE/server/$name.gpg"
    echo "$hash" > "$OFFSITE/server/$name.sha256"
    changed=$((changed + 1))
  fi
done

git -C "$OFFSITE" add -A
if git -C "$OFFSITE" diff --cached --quiet; then
  echo "off-site: nothing new ($(ls "$OFFSITE/media" | wc -l) media files backed up)"
  exit 0
fi
git -C "$OFFSITE" commit --quiet -m "Backup $(date +%F): $new new media file(s), $changed server file(s)"
git -C "$OFFSITE" push --quiet origin HEAD
echo "off-site: pushed $(git -C "$OFFSITE" log -1 --format='%h %s')"
