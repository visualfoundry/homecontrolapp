#!/usr/bin/env bash
# restore.sh — Full disaster-recovery restore for app.dixons.net
#
# Prerequisites on a fresh Ubuntu Server 24.04:
#   - Apache, PHP, MySQL, Node.js (v20 via NVM), PM2 installed
#   - SSH access as administrator
#   - This archive copied to ~/ via: scp -i key.pem hca-backup-*.tar.gz administrator@<new-ip>:~/
#
# Run as: administrator@<server>
#   bash ~/homecontrolapp/scripts/restore.sh ~/hca-backup-YYYYMMDD-HHMMSS.tar.gz
#
# What it does:
#   1. Extracts the archive
#   2. Restores WordPress (DB + files + config)
#   3. Restores env files and PM2 config
#   4. Restores Apache config and SSL certs
#   5. Clones the app repo (or skips if already present)
#   6. Installs dependencies and builds Next.js
#   7. Starts services via PM2

set -euo pipefail

ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" ]]; then
  echo "Usage: $0 <path-to-backup.tar.gz>"
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Error: archive not found: $ARCHIVE"
  exit 1
fi

EXTRACT_DIR="/tmp/hca-restore-$$"
echo "==> Extracting archive..."
mkdir -p "$EXTRACT_DIR"
tar -xzf "$ARCHIVE" -C "$EXTRACT_DIR"
BACKUP_DIR=$(ls "$EXTRACT_DIR")
SRC="$EXTRACT_DIR/$BACKUP_DIR"

echo "==> Restoring from: $BACKUP_DIR"
echo ""

# ── 1. MySQL database ────────────────────────────────────────────────────────
echo "==> Restoring WordPress database..."
WP_CONFIG_SRC="$SRC/wordpress/wp-config.php"

WP_DB_NAME=$(php -r "\$c=file_get_contents('$WP_CONFIG_SRC'); preg_match(\"/define\(\s*'DB_NAME'\s*,\s*'([^']+)'\)/\", \$c, \$m); echo \$m[1];")
WP_DB_USER=$(php -r "\$c=file_get_contents('$WP_CONFIG_SRC'); preg_match(\"/define\(\s*'DB_USER'\s*,\s*'([^']+)'\)/\", \$c, \$m); echo \$m[1];")
WP_DB_PASS=$(php -r "\$c=file_get_contents('$WP_CONFIG_SRC'); preg_match(\"/define\(\s*'DB_PASSWORD'\s*,\s*'([^']+)'\)/\", \$c, \$m); echo \$m[1];")

# Create DB and user if they don't exist
sudo mysql << SQL
CREATE DATABASE IF NOT EXISTS \`$WP_DB_NAME\` DEFAULT CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '$WP_DB_USER'@'localhost' IDENTIFIED BY '$WP_DB_PASS';
ALTER USER '$WP_DB_USER'@'localhost' IDENTIFIED BY '$WP_DB_PASS';
GRANT ALL PRIVILEGES ON \`$WP_DB_NAME\`.* TO '$WP_DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL

# Import the dump
zcat "$SRC/db/wordpress.sql.gz" | mysql -u "$WP_DB_USER" -p"$WP_DB_PASS" "$WP_DB_NAME"
echo "    Database restored: $WP_DB_NAME"

# ── 2. WordPress core (download fresh if not present) ───────────────────────
if [[ ! -f /var/www/html/wordpress/wp-login.php ]]; then
  echo "==> Downloading WordPress core..."
  sudo mkdir -p /var/www/html
  cd /var/www/html
  sudo wget -q https://wordpress.org/latest.tar.gz
  sudo tar -xzf latest.tar.gz
  sudo rm latest.tar.gz
  sudo chown -R www-data:www-data /var/www/html/wordpress
else
  echo "==> WordPress core already present — skipping download"
fi

# ── 3. WordPress config and content ─────────────────────────────────────────
echo "==> Restoring wp-config.php..."
sudo cp "$SRC/wordpress/wp-config.php" /var/www/html/wordpress/wp-config.php

if [[ -f "$SRC/wordpress/.htaccess" ]]; then
  sudo cp "$SRC/wordpress/.htaccess" /var/www/html/wordpress/.htaccess
fi

echo "==> Restoring wp-content/uploads..."
sudo mkdir -p /var/www/html/wordpress/wp-content/uploads
sudo rsync -a --quiet \
  "$SRC/wordpress/wp-content/uploads/" \
  /var/www/html/wordpress/wp-content/uploads/

echo "==> Restoring wp-content/plugins..."
sudo mkdir -p /var/www/html/wordpress/wp-content/plugins
sudo rsync -a --quiet \
  "$SRC/wordpress/wp-content/plugins/" \
  /var/www/html/wordpress/wp-content/plugins/

sudo chown -R www-data:www-data /var/www/html/wordpress/wp-content

# ── 4. App code ──────────────────────────────────────────────────────────────
if [[ ! -d "$HOME/homecontrolapp/.git" ]]; then
  echo "==> Cloning app repo..."
  git clone https://github.com/visualfoundry/homecontrolapp.git "$HOME/homecontrolapp"
else
  echo "==> App repo already cloned — pulling latest..."
  git -C "$HOME/homecontrolapp" pull
fi

# ── 5. Environment files ─────────────────────────────────────────────────────
echo "==> Restoring env files..."
cp "$SRC/app/next-app.env.local" "$HOME/homecontrolapp/next-app/.env.local"

if [[ -f "$SRC/app/home-control-services.env" ]]; then
  cp "$SRC/app/home-control-services.env" \
     "$HOME/homecontrolapp/home-control-services/.env"
fi

if [[ -f "$SRC/app/ecosystem.config.js" ]]; then
  cp "$SRC/app/ecosystem.config.js" "$HOME/homecontrolapp/ecosystem.config.js"
fi

# ── 6. Apache config ─────────────────────────────────────────────────────────
echo "==> Restoring Apache config..."
sudo cp "$SRC/apache/wordpress.conf" /etc/apache2/sites-available/wordpress.conf
sudo a2enmod rewrite ssl proxy proxy_http 2>/dev/null || true
sudo a2ensite wordpress.conf 2>/dev/null || true
sudo a2dissite 000-default.conf 2>/dev/null || true

# ── 7. SSL certificates ──────────────────────────────────────────────────────
echo "==> Restoring SSL certificates..."
sudo mkdir -p /etc/ssl/hca
sudo cp "$SRC/ssl/cert.pem" /etc/ssl/hca/cert.pem
sudo cp "$SRC/ssl/key.pem"  /etc/ssl/hca/key.pem
sudo chmod 600 /etc/ssl/hca/key.pem
sudo chown root:root /etc/ssl/hca/key.pem

if [[ -f "$SRC/ssl/mkcert-ca.pem" ]]; then
  cp "$SRC/ssl/mkcert-ca.pem" "$HOME/mkcert-ca.pem"
fi

echo "==> Testing Apache config..."
sudo apache2ctl configtest && sudo systemctl reload apache2

# ── 8. Netplan (only apply if on a new server — skip if IP already correct) ──
SERVER_IP=$(hostname -I | awk '{print $1}')
if [[ "$SERVER_IP" != "192.168.1.91" ]] && [[ -d "$SRC/netplan" ]]; then
  echo "==> Current IP is $SERVER_IP — restoring Netplan static IP config..."
  echo "    WARNING: You may lose SSH connectivity. Reconnect to 192.168.1.91 after."
  sudo cp "$SRC/netplan/"*.yaml /etc/netplan/
  sudo netplan apply
else
  echo "==> Static IP already set ($SERVER_IP) — skipping Netplan restore"
fi

# ── 9. WordPress theme ───────────────────────────────────────────────────────
echo "==> Linking WordPress theme..."
WP_THEME_SRC="$HOME/homecontrolapp"
WP_THEME_DST="/var/www/html/wordpress/wp-content/themes/homecontrolapp"
if [[ ! -e "$WP_THEME_DST" ]]; then
  sudo ln -s "$WP_THEME_SRC" "$WP_THEME_DST"
  sudo chown -h www-data:www-data "$WP_THEME_DST"
fi

# ── 10. Install dependencies and build ──────────────────────────────────────
echo "==> Installing home-control-services dependencies..."
cd "$HOME/homecontrolapp/home-control-services"
npm install

echo "==> Installing and building Next.js app..."
cd "$HOME/homecontrolapp/next-app"
npm install
npm run build

# ── 11. Start services ───────────────────────────────────────────────────────
echo "==> Starting PM2 services..."
cd "$HOME/homecontrolapp"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "==> Restore complete! Verifying services..."
echo ""
pm2 status
echo ""
echo "==> Verification commands:"
echo "    curl http://192.168.1.91/graphql -d '{\"query\":\"{ __typename }\"}' -H 'Content-Type: application/json'"
echo "    curl -s http://127.0.0.1:8081/state | python3 -c \"import sys,json; d=json.load(sys.stdin); print('Keys:', len(d))\""
echo "    curl -I http://localhost:3000"
echo ""
echo "==> If this is a new server, run PM2 startup:"
echo "    pm2 startup systemd"
echo "    (copy and run the printed sudo command)"
echo "    pm2 save"

# Cleanup
rm -rf "$EXTRACT_DIR"
