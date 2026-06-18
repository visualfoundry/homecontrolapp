#!/usr/bin/env bash
# backup.sh — Full disaster-recovery backup for app.dixons.net
#
# Run as: administrator@192.168.1.91
#   bash ~/homecontrolapp/scripts/backup.sh
#
# Creates: ~/hca-backup-YYYYMMDD-HHMMSS.tar.gz
# Contains everything needed to restore from scratch — see restore.sh.
# The archive contains the SSL private key; keep it in a secure location.

set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
WORKDIR="/tmp/hca-backup-$STAMP"
ARCHIVE="$HOME/hca-backup-$STAMP.tar.gz"

echo "==> Starting backup $STAMP"
mkdir -p "$WORKDIR"

# ── 1. WordPress database ────────────────────────────────────────────────────
echo "==> Dumping WordPress database..."
mkdir -p "$WORKDIR/db"
# Read credentials from wp-config.php so we don't hard-code them here
WP_DB_NAME=$(php -r "define('ABSPATH',''); \$c=file_get_contents('/var/www/html/wordpress/wp-config.php'); preg_match(\"/define\(\s*'DB_NAME'\s*,\s*'([^']+)'\)/\", \$c, \$m); echo \$m[1];")
WP_DB_USER=$(php -r "define('ABSPATH',''); \$c=file_get_contents('/var/www/html/wordpress/wp-config.php'); preg_match(\"/define\(\s*'DB_USER'\s*,\s*'([^']+)'\)/\", \$c, \$m); echo \$m[1];")
WP_DB_PASS=$(php -r "define('ABSPATH',''); \$c=file_get_contents('/var/www/html/wordpress/wp-config.php'); preg_match(\"/define\(\s*'DB_PASSWORD'\s*,\s*'([^']+)'\)/\", \$c, \$m); echo \$m[1];")

mysqldump --single-transaction \
  -u "$WP_DB_USER" -p"$WP_DB_PASS" "$WP_DB_NAME" \
  | gzip > "$WORKDIR/db/wordpress.sql.gz"
echo "    DB dump: $(du -sh "$WORKDIR/db/wordpress.sql.gz" | cut -f1)"

# ── 2. WordPress files (config + content, not core — core is re-downloadable) ─
echo "==> Backing up WordPress files..."
mkdir -p "$WORKDIR/wordpress"
sudo cp /var/www/html/wordpress/wp-config.php "$WORKDIR/wordpress/wp-config.php"
sudo cp /var/www/html/wordpress/.htaccess "$WORKDIR/wordpress/.htaccess" 2>/dev/null || true

# wp-content: uploads (media) + plugins. Skip themes (in git). Skip cache.
echo "    Copying wp-content/uploads..."
sudo rsync -a --quiet \
  /var/www/html/wordpress/wp-content/uploads/ \
  "$WORKDIR/wordpress/wp-content/uploads/"

echo "    Copying wp-content/plugins..."
sudo rsync -a --quiet \
  /var/www/html/wordpress/wp-content/plugins/ \
  "$WORKDIR/wordpress/wp-content/plugins/"

echo "    WordPress files: $(du -sh "$WORKDIR/wordpress" | cut -f1)"

# ── 3. App environment files and PM2 config ──────────────────────────────────
echo "==> Backing up app env files..."
mkdir -p "$WORKDIR/app"

cp "$HOME/homecontrolapp/next-app/.env.local" \
   "$WORKDIR/app/next-app.env.local"

if [[ -f "$HOME/homecontrolapp/home-control-services/.env" ]]; then
  cp "$HOME/homecontrolapp/home-control-services/.env" \
     "$WORKDIR/app/home-control-services.env"
fi

if [[ -f "$HOME/homecontrolapp/ecosystem.config.js" ]]; then
  cp "$HOME/homecontrolapp/ecosystem.config.js" \
     "$WORKDIR/app/ecosystem.config.js"
fi

# ── 4. Apache config ─────────────────────────────────────────────────────────
echo "==> Backing up Apache config..."
mkdir -p "$WORKDIR/apache"
sudo cp /etc/apache2/sites-available/wordpress.conf \
        "$WORKDIR/apache/wordpress.conf"
sudo cp -r /etc/apache2/sites-enabled/ "$WORKDIR/apache/sites-enabled/" 2>/dev/null || true

# ── 5. Netplan (static IP) ───────────────────────────────────────────────────
echo "==> Backing up Netplan config..."
mkdir -p "$WORKDIR/netplan"
sudo cp /etc/netplan/*.yaml "$WORKDIR/netplan/" 2>/dev/null || true

# ── 6. SSL certificates ──────────────────────────────────────────────────────
echo "==> Backing up SSL certificates..."
mkdir -p "$WORKDIR/ssl"
sudo cp /etc/ssl/hca/cert.pem "$WORKDIR/ssl/cert.pem"
sudo cp /etc/ssl/hca/key.pem  "$WORKDIR/ssl/key.pem"

# mkcert root CA (needed for new device setup)
if [[ -f "$HOME/mkcert-ca.pem" ]]; then
  cp "$HOME/mkcert-ca.pem" "$WORKDIR/ssl/mkcert-ca.pem"
fi

# ── 7. PM2 saved process list ────────────────────────────────────────────────
echo "==> Saving PM2 process list..."
pm2 save --force 2>/dev/null || true
if [[ -f "$HOME/.pm2/dump.pm2" ]]; then
  mkdir -p "$WORKDIR/pm2"
  cp "$HOME/.pm2/dump.pm2" "$WORKDIR/pm2/dump.pm2"
fi

# ── 8. Fix ownership so we can read everything ──────────────────────────────
sudo chown -R administrator:administrator "$WORKDIR"

# ── 9. Write a manifest ──────────────────────────────────────────────────────
cat > "$WORKDIR/MANIFEST.txt" << EOF
Home Control App — Disaster Recovery Backup
Created: $STAMP
Hostname: $(hostname)
Server IP: $(hostname -I | awk '{print $1}')

Contents:
  db/wordpress.sql.gz           WordPress MySQL database
  wordpress/wp-config.php       WP secrets (DB creds, auth keys, salts)
  wordpress/.htaccess           WP URL rewriting
  wordpress/wp-content/uploads/ Uploaded media files
  wordpress/wp-content/plugins/ Installed plugins
  app/next-app.env.local        Next.js env (GraphQL URL, secrets, Spotify)
  app/home-control-services.env State service env (EISY IPs, credentials)
  app/ecosystem.config.js       PM2 process definitions
  apache/wordpress.conf         Apache virtual host config
  netplan/*.yaml                Static IP network config
  ssl/cert.pem                  TLS certificate (covers 192.168.1.91 + app.dixons.net)
  ssl/key.pem                   TLS private key  *** KEEP SECURE ***
  ssl/mkcert-ca.pem             mkcert root CA cert (for new device onboarding)
  pm2/dump.pm2                  PM2 saved process list

What is NOT included (re-clone or re-download):
  ~/homecontrolapp/             App code — git clone from GitHub
  /var/www/html/wordpress/      WordPress core — download from wordpress.org
  node_modules/                 Run npm install after clone
  .next/                        Run npm run build after install

Restore:
  See restore.sh in ~/homecontrolapp/scripts/
EOF

# ── 10. Create the archive ───────────────────────────────────────────────────
echo "==> Creating archive..."
tar -czf "$ARCHIVE" -C /tmp "hca-backup-$STAMP"
rm -rf "$WORKDIR"

echo ""
echo "==> Backup complete!"
echo "    Archive: $ARCHIVE"
echo "    Size:    $(du -sh "$ARCHIVE" | cut -f1)"
echo ""
echo "==> Copy to your Mac:"
echo "    scp -i 192.168.1.91-key.pem administrator@192.168.1.91:$ARCHIVE ~/Desktop/"
