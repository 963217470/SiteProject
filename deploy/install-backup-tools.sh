#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]]
umask 077
source=$(cd -- "$(dirname -- "$0")" && pwd)
target=/opt/rd-studio/ops
install -d -m 700 "$target"
for file in backup.sh verify-snapshot.sh rollback-code.sh data-inventory.mjs verify-backup.mjs backup-crypto.mjs check-code-compatibility.mjs verify-encrypted-backup.mjs; do
    if [[ "$file" == *.sh ]]; then bash -n "$source/$file"; else /opt/rd-studio/node/bin/node --check "$source/$file"; fi
    install -m 700 "$source/$file" "$target/$file"
done
if [[ ! -e /root/.rd-studio-backup.key ]]; then
    /opt/rd-studio/node/bin/node --input-type=module -e 'import {randomBytes} from "node:crypto";import {writeFileSync} from "node:fs";writeFileSync("/root/.rd-studio-backup.key",randomBytes(32),{mode:0o600,flag:"wx"})'
fi
chmod 600 /root/.rd-studio-backup.key
install -m 644 "$source/rd-studio-backup.service" /etc/systemd/system/rd-studio-backup.service
install -m 644 "$source/rd-studio-backup.timer" /etc/systemd/system/rd-studio-backup.timer
systemd-analyze verify /etc/systemd/system/rd-studio-backup.service /etc/systemd/system/rd-studio-backup.timer
systemctl daemon-reload
systemctl enable --now rd-studio-backup.timer
echo 'Backup tools installed; daily 04:00 Asia/Shanghai timer enabled'
