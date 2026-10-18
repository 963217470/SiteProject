#!/usr/bin/env bash
set -euo pipefail
echo 'Retired deployment entry point. Use deploy-note-upload.sh with verified full backups.' >&2
exit 1
root=/opt/rd-studio
old=$(readlink -f "$root/current")
[[ -L "$root/current" && "$old" == "$root/releases/"* && -f "$old/server/app.mjs" ]]
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="$root/releases/rd-mcp-$stamp"
[[ ! -e "$release" ]]
backup="/var/backups/rd-studio/mcp-$stamp"
mkdir -p "$backup"
tar --exclude=node_modules -czf "$backup/previous-backend.tar.gz" -C "$old" .
sha256sum "$backup/previous-backend.tar.gz" > "$backup/SHA256SUMS"
sha256sum -c "$backup/SHA256SUMS"
cp -a "$old" "$release"
tar -xzf /tmp/rd-mcp-backend.tar.gz -C "$release"
export PATH="/opt/rd-studio/node/bin:$PATH"
cd "$release/server"
npm ci --omit=dev --no-audit --no-fund
node --check app.mjs
node --check mcp.mjs
node --input-type=module -e "await import('./mcp.mjs')"
rollback(){ ln -s "$old" "$root/current.rollback-$stamp"; mv -Tf "$root/current.rollback-$stamp" "$root/current"; systemctl restart rd-studio; }
trap rollback ERR
ln -s "$release" "$root/current.next-$stamp"
mv -Tf "$root/current.next-$stamp" "$root/current"
systemctl restart rd-studio
for attempt in {1..15}; do if curl -fsS http://127.0.0.1:3100/api/health -o /dev/null; then break; fi; sleep 1; done
curl -fsS http://127.0.0.1:3100/api/health -o /dev/null
curl -fsS http://127.0.0.1:3100/api/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"deployment-check","version":"1.0.0"}}}'
trap - ERR
printf '\nBACKEND=%s\nBACKUP=%s\nPREVIOUS=%s\n' "$release" "$backup" "$old"
