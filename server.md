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
sudo ufw allow 80/tcp       # WordPress (Apache)
sudo ufw allow 3000/tcp     # Next.js PWA
# Port 8081 (state service) is internal only — do NOT open it
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

| Service | URL |
|---|---|
| WordPress admin | `http://192.168.1.91/wp-admin` |
| WPGraphQL endpoint | `http://192.168.1.91/graphql` |
| Next.js PWA | `http://192.168.1.91:3000` |
| State service (internal only) | `http://127.0.0.1:8081` |

> The PWA home screen shortcut points to `http://192.168.1.91:3000`.  
> Port 8081 is never exposed outside the server — Next.js proxies it.
