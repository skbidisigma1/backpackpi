#!/usr/bin/env bash
set -euo pipefail
SERVICE_NAME="backpackpi-backend"
TARGET_DIR="/opt/backpackpi/app"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$EUID" -ne 0 ]; then
  echo "[install-service] Please run as root (sudo)" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
# Copy current contents (expect run.sh, server/, dist/, package.json, package-lock.json)
rsync -a --delete ./ "$TARGET_DIR" --exclude .git --exclude node_modules || true

cat > "$UNIT_FILE" <<EOF
[Unit]
Description=BackpackPi backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${TARGET_DIR}
ExecStart=${TARGET_DIR}/run.sh
Restart=on-failure
Environment=NODE_ENV=production
Environment=FILE_ROOT=${TARGET_DIR}

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$UNIT_FILE"

systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}.service

systemctl status --no-pager ${SERVICE_NAME}.service || true

echo "Service ${SERVICE_NAME} installed and started."