# Home Control App — Dedicated Linux Server Deployment

This guide covers wiping Windows and installing Ubuntu Server 24.04 LTS, then deploying all three components of the app.

**Why Linux over Windows + WSL2:**
- No Windows Update forced reboots taking down your home controls
- Half the RAM overhead (no Windows idle cost)
- systemd starts services automatically on boot — no Task Scheduler hacks
- Simpler networking, no WSL2 virtual NIC layer

---

## What will run on the server

The server we are using is: DELL Optiplex 5070 Micro MFF Desktop PC Intel i5-9500T

| Component | What it is | How it runs |
|---|---|---|
| WordPress | Config plane (CPT/ACF/WPGraphQL) | Apache + PHP + MySQL, systemd managed |
| Next.js app | The PWA front-end | Node.js, PM2 + systemd managed |
| home-control-services | EISY poller + SSE/command API | Node.js, PM2 + systemd managed |

The server must be on the **same local network as the EISYs** (192.168.1.x).

---

## Table of Contents

- [Part 1 — Wipe Windows and install Ubuntu Server](#part-1--wipe-windows-and-install-ubuntu-server)
- [Part 2 — Install server dependencies](#part-2--install-server-dependencies)
- [Part 3 — Set up WordPress](#part-3--set-up-wordpress)
- [Part 4 — Deploy the app code](#part-4--deploy-the-app-code)
- [Part 5 — Network and static IP](#part-5--network-and-static-ip)
- [Part 6 — Security basics](#part-6--security-basics)
- [Part 7 — SSL certificates](#part-7--ssl-certificates)
- [Part 8 — Public access via app.dixons.net](#part-8--public-access-via-appdixonsnet)
- [Part 9 — Disaster-recovery backups](#part-9--disaster-recovery-backups)
- [Verification checklist](#verification-checklist)
- [Managing the server day-to-day](#managing-the-server-day-to-day)
- [URL summary](#url-summary)

---

## Part 1 — Wipe Windows and install Ubuntu Server

### Step 1 — Create a bootable USB (on your Mac)

Download Ubuntu Server 24.04 LTS:
```
https://ubuntu.com/download/server
```

Flash it to a USB drive (8 GB+). On your Mac, using Balena Etcher (easiest):
```
https://etcher.balena.io
```
Or via Terminal (replace `diskN` with your USB disk from `diskutil list`):
```bash
diskutil unmountDisk /dev/diskN
sudo dd if=~/Downloads/ubuntu-24.04-live-server-amd64.iso of=/dev/rdiskN bs=1m status=progress
```

### Step 2 — Boot from USB

1. Plug the USB into the server and power it on
2. Press the BIOS/boot menu key as it starts — usually **F2**, **F12**, **Del**, or **Esc** (varies by motherboard) (F2 for the Dell)
3. Select the USB drive as the boot device (UEFI)

> **BIOS storage mode — must be AHCI, not RAID/RST**
> If the installer shows *"Block probing did not discover any disks"*, the SATA controller is in RAID/RST mode.
> Go into BIOS → Advanced → Storage Configuration → SATA Mode → **AHCI**, save and reboot.
>
> **If Windows was installed in RAID mode**, switch Windows to AHCI first or it will blue screen:
> 1. In Windows, open Command Prompt as administrator and run: `bcdedit /set {current} safeboot minimal`
> 2. Reboot → enter BIOS → change to AHCI → save/exit
> 3. Windows boots into Safe Mode and installs the AHCI driver automatically
> 4. Open Command Prompt as administrator and run: `bcdedit /deletevalue {current} safeboot`
> 5. Reboot — Windows now boots normally with AHCI

### Step 3 — Install Ubuntu Server

Follow the installer prompts:

- **Language / keyboard:** your preference
- **Type of install:** Ubuntu Server (not minimized)
- **Network:** configure your static IP here (see below) or leave as DHCP and set it later
- **Storage:** choose **Use an entire disk** → select the server's drive → **Done**
  - It will warn that this erases everything — confirm. This wipes Windows.
- **Storage layout:** leave as default LVM
- **Profile setup:**
  - Your name: anything
  - Server name: `homecontrol` (or your preference)
  - Username: `administrator` ← configured during install; used in all paths below
  - Password: something strong
- **SSH:** check **Install OpenSSH server** ✓ — SSH keys imported from GitHub during installer setup ✓
- **Git keys:** SSH public key added during installer so the server can authenticate to GitHub for `git clone` / `git pull`
- **Featured snaps:** skip all, press Done

The installer will copy files and reboot. Remove the USB when prompted.

### Step 4 — First login and update

Either plug in a monitor/keyboard, or SSH from your Mac once it boots:
```bash
ssh administrator@<server-ip>
```

Update everything:
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

---

## Part 2 — Install server dependencies

### Step 5 — Install PHP, Apache, MySQL

```bash
sudo apt install -y apache2 php php-mysql php-curl php-xml \
  php-mbstring php-zip php-gd libapache2-mod-php \
  mysql-server unzip curl git

sudo a2enmod rewrite
sudo systemctl enable apache2 mysql
sudo systemctl start apache2 mysql
```

### Step 6 — Install Node.js via NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v   # should print v20.x.x
npm -v
```

### Step 7 — Install PM2

```bash
npm install -g pm2
```

---

## Part 3 — Set up WordPress

### Step 8 — Create the MySQL database

```bash
sudo mysql
```
```sql
CREATE DATABASE wordpress DEFAULT CHARACTER SET utf8mb4;
CREATE USER 'wpuser'@'localhost' IDENTIFIED BY 'replace-with-a-real-password';
GRANT ALL PRIVILEGES ON wordpress.* TO 'wpuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> **Replace the password** before running — do not use the placeholder literally.
> If you accidentally ran it with the placeholder, fix it:
> ```bash
> sudo mysql -e "ALTER USER 'wpuser'@'localhost' IDENTIFIED BY 'your-real-password'; FLUSH PRIVILEGES;"
> ```

### Step 9 — Export WordPress from Local (on your Mac)

In **Local by Flywheel**, right-click the site → **Export** → unzip the archive.
The export contains:
- Database: `app/sql/local.sql`
- WordPress files: `app/public/` (wp-content is what we need)

Copy both to the server (replace the path with wherever you unzipped the export):
```bash
scp ~/Downloads/Home\ Control\ App/app/sql/local.sql administrator@192.168.1.91:~
scp -r ~/Downloads/Home\ Control\ App/app/public/wp-content administrator@192.168.1.91:~
```

### Step 10 — Install WordPress on the server

```bash
# Ensure the web root exists (Apache may not create it automatically)
sudo mkdir -p /var/www/html

# Download WordPress
cd /var/www/html
sudo wget -q https://wordpress.org/latest.tar.gz
sudo tar -xzf latest.tar.gz
sudo rm latest.tar.gz

# Restore wp-content from your Mac export
# Note: cp replaces the whole wp-content dir, so copy plugins and themes separately
# to avoid overwriting WordPress core stubs (hello.php, akismet, etc.)
sudo cp -r ~/wp-content/plugins/* /var/www/html/wordpress/wp-content/plugins/
sudo cp -r ~/wp-content/themes/*  /var/www/html/wordpress/wp-content/themes/
sudo chown -R www-data:www-data /var/www/html/wordpress/wp-content

# Remove default placeholder themes
sudo rm -rf /var/www/html/wordpress/wp-content/themes/twentytwenty*

# Import the database
mysql -u wpuser -p wordpress < ~/local.sql

# Configure wp-config.php
sudo cp /var/www/html/wordpress/wp-config-sample.php /var/www/html/wordpress/wp-config.php
sudo nano /var/www/html/wordpress/wp-config.php
```

Set these values in `wp-config.php`:
```php
define( 'DB_NAME',     'wordpress' );
define( 'DB_USER',     'wpuser' );
define( 'DB_PASSWORD', 'your-strong-db-password' );
define( 'DB_HOST',     'localhost' );

// Copy these from the wp-config.php on your Mac:
define( 'NEXT_APP_URL',       'http://127.0.0.1:3000' );
define( 'REVALIDATE_SECRET',  '...' );
define( 'WP_AUTH_KEY',        '...' );
define( 'HCA_INTERNAL_KEY',   '...' );
// ... and the AUTH_KEY / SECURE_AUTH_KEY / LOGGED_IN_KEY salts
```

Update the WordPress site URL in the database:
```bash
mysql -u wpuser -p wordpress -e "UPDATE wp_options SET option_value = 'http://192.168.1.91' WHERE option_name IN ('siteurl', 'home');"
```

Verify it took effect:
```bash
mysql -u wpuser -p wordpress -e "SELECT option_name, option_value FROM wp_options WHERE option_name IN ('siteurl', 'home');"
```
Both rows should show `http://192.168.1.91`.

Configure Apache for WordPress:
```bash
sudo nano /etc/apache2/sites-available/wordpress.conf
```
```apache
<VirtualHost *:80>
    ServerName 192.168.1.91
    DocumentRoot /var/www/html/wordpress

    <Directory /var/www/html/wordpress>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/wp-error.log
    CustomLog ${APACHE_LOG_DIR}/wp-access.log combined
</VirtualHost>
```
```bash
sudo a2ensite wordpress.conf
sudo a2dissite 000-default.conf
sudo systemctl reload apache2
```

---

## Part 4 — Deploy the app code

### Step 11 — Clone the repo

Use HTTPS — the SSH key added during Ubuntu install authenticates to the server itself, not to GitHub:
```bash
cd ~
git clone https://github.com/visualfoundry/homecontrolapp.git homecontrolapp
```

### Step 12 — Configure environment files

**`home-control-services/.env`** — create from scratch (no `.env.example` in the repo):
```bash
nano ~/homecontrolapp/home-control-services/.env
```
Paste the contents from your Mac's `home-control-services/.env`. The EISY IP addresses are the same LAN so no changes needed.

**`next-app/.env.local`** — create this file:
```bash
nano next-app/.env.local
```
> **Important:** if you copy `.env.local` from your Mac (Local by Flywheel), `NEXT_PUBLIC_WP_GRAPHQL_URL`
> will still point to `http://localhost:10048/graphql`. You **must** change it to the server IP — login
> will return 503 until you do.

```bash
NEXT_PUBLIC_WP_GRAPHQL_URL=http://192.168.1.91/graphql
STATE_API_BASE_URL=http://127.0.0.1:8081
REVALIDATE_SECRET=<same value as wp-config.php>
WP_AUTH_KEY=<same value as wp-config.php>
HCA_INTERNAL_KEY=<same value as wp-config.php>
NEXTAUTH_SECRET=<same value as on Mac>
NEXTAUTH_URL=http://192.168.1.91:3000

# Spotify — copy from Mac .env.local
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REFRESH_TOKEN=...
```

### Step 13 — Install dependencies and build

```bash
# home-control-services
cd ~/homecontrolapp/home-control-services
npm install

# Next.js — production build
cd ~/homecontrolapp/next-app
npm install
npm run build
```

### Step 14 — Create the PM2 ecosystem file

```bash
cat > ~/homecontrolapp/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'hca-state',
      cwd: '/home/administrator/homecontrolapp/home-control-services',
      script: 'node',
      args: '--import tsx src/index.ts',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'hca-next',
      cwd: '/home/administrator/homecontrolapp/next-app',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
EOF
```

### Step 15 — Start services and configure auto-start

```bash
# Start both Node.js services
cd ~/homecontrolapp
pm2 start ecosystem.config.js

# Check they're running
pm2 status
pm2 logs hca-state --lines 30
pm2 logs hca-next --lines 30

# Hook PM2 into systemd so services survive reboots
pm2 startup systemd
# The above command prints a sudo command — copy and run it, e.g.:
sudo env PATH=$PATH:/home/administrator/.nvm/versions/node/v20.x.x/bin \
  /home/administrator/.nvm/versions/node/v20.x.x/lib/node_modules/pm2/bin/pm2 \
  startup systemd -u administrator --hp /home/administrator

# Save the current process list
pm2 save
```

From this point on, both Node.js services start automatically on every boot with no further configuration.

---

## Part 5 — Network and static IP

### Step 16 — Assign a static IP to the server

Ubuntu Server uses **Netplan** for network configuration. Find your network interface name:
```bash
ip link show
# Look for something like: eno1, eth0, enp3s0
```

Edit the Netplan config:
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```
```yaml
network:
  version: 2
  ethernets:
    eno1:                        # replace with your interface name
      dhcp4: no
      addresses:
        - 192.168.1.91/24        # choose a free IP on your LAN
      routes:
        - to: default
          via: 192.168.1.1       # your router's IP
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```
```bash
sudo netplan apply
```

Verify:
```bash
ip addr show eno1
# Should show inet 192.168.1.91/24
```

---

## Part 6 — Security basics

### Step 17 — Firewall

```bash
sudo ufw allow OpenSSH      # SSH — keep this or you'll lock yourself out
sudo ufw allow 80/tcp       # WordPress HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp      # WordPress HTTPS
sudo ufw allow 3443/tcp     # Next.js PWA HTTPS (Apache proxy)
# Port 3000 (Next.js direct) and 8081 (state service) are internal only — do NOT open them
sudo ufw enable
sudo ufw status
```

### Step 18 — Automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
# Choose "Yes" — security patches apply automatically without rebooting
```

---

## Verification checklist

```bash
# All services running?
pm2 status
systemctl status apache2
systemctl status mysql

# WordPress GraphQL responding?
curl http://192.168.1.91/graphql \
  -d '{"query":"{ __typename }"}' \
  -H "Content-Type: application/json"

# State service live with expected key count?
curl -s http://127.0.0.1:8081/state | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print('Keys:', len(d))"

# Pool controller node publishing?
curl -s http://127.0.0.1:8081/state | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('eisy0/n003_bow1'))"

# Next.js app responding?
curl -I http://localhost:3000
```

---

## Managing the server day-to-day

```bash
# SSH in from your Mac
ssh administrator@192.168.1.91

# Check service status
pm2 status

# View live logs
pm2 logs hca-state
pm2 logs hca-next

# Restart a service
pm2 restart hca-next

# Deploy a code update (Next.js code changed)
cd ~/homecontrolapp
git pull
cd next-app && npm install && npm run build
pm2 restart hca-next

# Deploy a config-only update (devices.json or home-control-services only — no rebuild needed)
cd ~/homecontrolapp
git pull
pm2 restart hca-state

# Restart everything after a config change
pm2 restart all
```

---

## URL summary

| Service | LAN URL | Public URL |
|---|---|---|
| Next.js PWA | `https://192.168.1.91:3443` | `https://app.dixons.net` |
| WordPress admin | `https://192.168.1.91/wp-admin` | LAN / VPN only |
| WPGraphQL endpoint | `https://192.168.1.91/graphql` | `https://app.dixons.net/graphql` |
| State service | internal only — `http://127.0.0.1:8081` | not exposed |

> Port 8081 is never exposed outside the server — Next.js proxies it internally.
> WP admin is restricted to `192.168.1.0/24` in Apache — use VPN to access it remotely.

---

## Part 7 — SSL certificates

### Current setup (LAN + public)

SSL is provided by **mkcert** — a local CA that issues trusted certificates for both LAN and public access.

Two certificates to understand:
| Certificate | Location | Valid for | Action on expiry |
|---|---|---|---|
| Root CA | Installed on each device once | **10 years** | Reinstall on all devices |
| Server cert | `/etc/ssl/hca/cert.pem` | **2 years (~June 2028)** | Renew on server only |

The server cert covers both `192.168.1.91` and `app.dixons.net` as SANs. The Root CA is installed once per device. When the server cert renews, devices automatically trust the new cert — no action needed on devices.

### Apache SSL configuration (complete)

```bash
sudo nano /etc/apache2/sites-available/wordpress.conf
```
```apache
# ── Port 80 — localhost internal (no redirect — serves WP directly for Next.js) ─
# Must be first so Apache matches it before the wildcard *:80 block below.
# Next.js fetches http://127.0.0.1/graphql internally; without this block Apache
# would redirect that request to HTTPS, dropping the POST body and breaking config.
<VirtualHost *:80>
    ServerName 127.0.0.1
    DocumentRoot /var/www/html/wordpress
    <Directory /var/www/html/wordpress>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>

# ── Port 80 — CA cert + redirect ───────────────────────────────────────────
<VirtualHost *:80>
    ServerName app.dixons.net
    # Serve the mkcert CA cert over plain HTTP (needed for iOS install before cert is trusted)
    Alias /mkcert-ca.pem /home/administrator/mkcert-ca.pem
    <Location /mkcert-ca.pem>
        Require all granted
    </Location>
    # Redirect everything else to HTTPS
    RedirectMatch permanent "^/(?!mkcert-ca\.pem)" https://app.dixons.net/
</VirtualHost>

# ── Port 443 — WordPress (LAN direct) ──────────────────────────────────────
<VirtualHost *:443>
    ServerName 192.168.1.91
    DocumentRoot /var/www/html/wordpress
    SSLEngine on
    SSLCertificateFile    /etc/ssl/hca/cert.pem
    SSLCertificateKeyFile /etc/ssl/hca/key.pem
    <Directory /var/www/html/wordpress>
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog ${APACHE_LOG_DIR}/wp-error.log
    CustomLog ${APACHE_LOG_DIR}/wp-access.log combined
</VirtualHost>

# ── Port 443 — app.dixons.net (public — WP paths + Next.js proxy) ──────────
<VirtualHost *:443>
    ServerName app.dixons.net
    DocumentRoot /var/www/html/wordpress
    SSLEngine on
    SSLCertificateFile    /etc/ssl/hca/cert.pem
    SSLCertificateKeyFile /etc/ssl/hca/key.pem

    <Directory /var/www/html/wordpress>
        AllowOverride All
        Require all granted
    </Directory>

    # WP admin restricted to LAN only — use VPN to access remotely
    <Location /wp-admin>
        Require ip 192.168.1.0/24
        Require ip 127.0.0.1
    </Location>
    <Location /wp-login.php>
        Require ip 192.168.1.0/24
        Require ip 127.0.0.1
    </Location>

    # WordPress paths served from local files; everything else → Next.js
    ProxyPreserveHost On
    ProxyPass /wp-admin     !
    ProxyPass /wp-login.php !
    ProxyPass /wp-json      !
    ProxyPass /wp-content   !
    ProxyPass /wp-includes  !
    ProxyPass /xmlrpc.php   !
    ProxyPass /graphql      !
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    ErrorLog ${APACHE_LOG_DIR}/app-error.log
    CustomLog ${APACHE_LOG_DIR}/app-access.log combined
</VirtualHost>

# ── Port 3443 — Next.js (LAN direct) ───────────────────────────────────────
<VirtualHost *:3443>
    ServerName 192.168.1.91
    SSLEngine on
    SSLCertificateFile    /etc/ssl/hca/cert.pem
    SSLCertificateKeyFile /etc/ssl/hca/key.pem
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```
```bash
sudo a2enmod ssl proxy proxy_http rewrite
sudo apache2ctl configtest && sudo systemctl reload apache2
```

### WordPress dynamic URL (wp-config.php)

WordPress's `siteurl` must match the domain being used — otherwise the admin panel redirects to the wrong host. Override it dynamically so both LAN and public access work without a database change:

Add these two lines to `/var/www/html/wordpress/wp-config.php` **before** the `/* That's all, stop editing! */` line:

```php
define( 'WP_HOME',    'https://' . $_SERVER['HTTP_HOST'] );
define( 'WP_SITEURL', 'https://' . $_SERVER['HTTP_HOST'] );
```

### Adding a new device (iOS)

The mkcert Root CA must be installed once per device before the app will load without a certificate warning.

> **Prerequisite:** `mkcert-ca.pem` must be in the Apache web root so it can be served over plain HTTP (the device can't use HTTPS before the cert is trusted). If you get a 404 when scanning the QR code, run this on the server:
> ```bash
> sudo cp ~/mkcert-ca.pem /var/www/html/wordpress/mkcert-ca.pem
> sudo chmod 644 /var/www/html/wordpress/mkcert-ca.pem
> ```
> The backup/restore scripts handle this automatically going forward.

1. Open **Safari** on the iOS device and go to `http://192.168.1.91/mkcert-ca.pem`
2. Tap **Allow** when prompted to download the profile
3. Go to **Settings → General → VPN & Device Management** → tap the profile → **Install**
4. Enter your passcode → **Install** on the warning screen
5. Go to **Settings → General → About → Certificate Trust Settings** → enable full trust for the mkcert CA
6. Open `https://app.dixons.net` in Safari — the app loads trusted and can be added to the home screen

> If Safari redirects to `https://` instead of downloading in step 1, clear Safari history first:
> **Settings → Apps → Safari → Clear History and Website Data**, then try again.

### Renewing the server certificate (June 2028)

Run on your Mac:
```bash
cd /path/to/theme
mkcert -key-file 192.168.1.91-key.pem -cert-file 192.168.1.91.pem 192.168.1.91 app.dixons.net
scp 192.168.1.91.pem administrator@192.168.1.91:~
scp 192.168.1.91-key.pem administrator@192.168.1.91:~
```

Then on the server:
```bash
sudo cp ~/192.168.1.91.pem /etc/ssl/hca/cert.pem
sudo cp ~/192.168.1.91-key.pem /etc/ssl/hca/key.pem
sudo chmod 600 /etc/ssl/hca/key.pem
sudo systemctl reload apache2
```

No device changes needed — the Root CA is still valid.

---

## Part 8 — Public access via app.dixons.net

> **Live as of June 2026.** DNS, port forward, cert SAN, Apache routing, and security hardening are all in place.

### What's deployed

- **DNS:** `app.dixons.net` A record → home public IP
- **Router:** port 443 forwarded to `192.168.1.91:443`
- **Cert SAN:** mkcert cert covers both `192.168.1.91` and `app.dixons.net`
- **Apache:** separate `app.dixons.net` VirtualHost on port 443 with path-based routing (see Part 7)
- **Security:** WP admin restricted to LAN; fail2ban installed; SSH key-only
- **NEXTAUTH_URL:** `https://app.dixons.net` in `.env.local`

### Path routing on app.dixons.net

| Path | Served by |
|---|---|
| `/graphql`, `/wp-json`, `/wp-content`, `/wp-includes`, `/xmlrpc.php` | WordPress (local files) |
| `/wp-admin`, `/wp-login.php` | WordPress — **LAN only** (403 from internet) |
| Everything else | Next.js proxy → `127.0.0.1:3000` |

### Accessing WP admin remotely

`/wp-admin` is blocked from the public internet. To access it when away from home, connect via VPN first — this puts you on the `192.168.1.0/24` LAN and the restriction is lifted.

### Security hardening in place

- **fail2ban** — blocks brute-force SSH and login attempts
- **WP admin LAN-only** — enforced in Apache `<Location>` block
- **SSH key-only** — verify with:
  ```bash
  sudo grep PasswordAuthentication /etc/ssh/sshd_config
  # Should show: PasswordAuthentication no
  ```
- **Port 3443 not forwarded** — LAN direct access only; internet traffic uses 443

---

## Part 9 — Disaster-recovery backups

The backup script (`scripts/backup.sh`) captures everything needed to restore the server from scratch:

| Item | Location in archive |
|---|---|
| WordPress database | `db/wordpress.sql.gz` |
| `wp-config.php` (all secrets) | `wordpress/wp-config.php` |
| WordPress `.htaccess` | `wordpress/.htaccess` |
| Media uploads | `wordpress/wp-content/uploads/` |
| Installed plugins | `wordpress/wp-content/plugins/` |
| Next.js env file | `app/next-app.env.local` |
| State service env file | `app/home-control-services.env` |
| PM2 ecosystem config | `app/ecosystem.config.js` |
| Apache vhost config | `apache/wordpress.conf` |
| Netplan static IP config | `netplan/00-installer-config.yaml` |
| TLS certificate | `ssl/cert.pem` |
| TLS private key ⚠️ | `ssl/key.pem` |
| mkcert root CA | `ssl/mkcert-ca.pem` |
| PM2 saved process list | `pm2/dump.pm2` |

**Not included** (re-clone or re-download on restore): app code (GitHub), WordPress core (wordpress.org), `node_modules/`, `.next/` build.

### Step 1 — One-time sudo setup (run once on the server)

The backup script re-execs itself with `sudo` to read `/etc/ssl`, `/etc/apache2`, and `wp-config.php`. Without this step, running the backup over non-interactive SSH will fail with:

```
sudo: A terminal is required to authenticate
```

This happens because non-interactive SSH has no TTY for sudo to prompt for a password. Fix it once by SSHing in interactively (where you can type your password) and creating a NOPASSWD rule:

```bash
ssh administrator@192.168.1.91
echo 'administrator ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/administrator-nopasswd
exit
```

After this, `sudo` works without a password or TTY and the backup command in Step 2 runs cleanly over non-interactive SSH.

### Step 2 — Run the backup

SSH in and run the script. It re-execs itself with sudo automatically, then creates a timestamped archive in `~/`:

```bash
ssh administrator@192.168.1.91 \
  "cd ~/homecontrolapp && git pull && bash scripts/backup.sh"
```

The script prints the archive path and size at the end, e.g.:

```
==> Backup complete!
    Archive: /home/administrator/hca-backup-20260618-221927.tar.gz
    Size:    12M
```

### Step 3 — Copy archive to your Mac

Run this from your Mac (the key file lives in the theme directory):

```bash
cd "/Volumes/Project Local/Development/Local Sites/home-control-app/app/public/wp-content/themes/homecontrolapp"

scp -i 192.168.1.91-key.pem \
  administrator@192.168.1.91:/home/administrator/hca-backup-YYYYMMDD-HHMMSS.tar.gz \
  ~/Desktop/
```

Replace `YYYYMMDD-HHMMSS` with the actual timestamp from Step 2.

> **Keep the archive secure.** It contains the TLS private key and all application secrets. Store it on an encrypted drive or as an encrypted attachment — not in iCloud or git.

### Restoring from a backup

See `scripts/restore.sh`. Copy the archive to the new server first, then:

```bash
scp -i 192.168.1.91-key.pem \
  ~/Desktop/hca-backup-YYYYMMDD-HHMMSS.tar.gz \
  administrator@192.168.1.91:~/

ssh administrator@192.168.1.91
bash ~/homecontrolapp/scripts/restore.sh ~/hca-backup-YYYYMMDD-HHMMSS.tar.gz
```

The restore script: imports the DB, downloads WordPress core, restores all files and env, clones the app repo, runs `npm install && npm run build`, and starts PM2.
