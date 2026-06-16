# Home Control App

Headless PWA for home automation. WordPress (CPT/ACF) provides device config via WPGraphQL; a Node.js aggregator service polls the EISY controllers and serves live state over SSE. Next.js joins the two at runtime.

For full architecture details see `CLAUDE.md`. For server setup and deployment see `server.md`.

---

## Repo structure

```
homecontrolapp/
├── next-app/               Next.js App Router (TypeScript + Tailwind)
│   ├── src/app/            Pages, API routes, layout
│   ├── src/screens/        One file per screen (HomeScreen, LightsScreen, …)
│   ├── src/components/     Shared UI primitives (Card, Toggle, Slider, …)
│   ├── src/lib/            Config fetch, state client, GraphQL, store
│   └── src/types/          Shared TypeScript types
├── home-control-services/  State aggregator (Express + TypeScript)
│   ├── src/                Poller, EISY client, state store, SSE stream
│   └── devices.json        Device map exported from WP (see below)
├── scss/                   WordPress theme styles (compiled → css/main.css)
└── server.md               Server setup, Apache config, SSL, deployment
```

---

## Prerequisites

- **Node.js** 20+ (use [nvm](https://github.com/nvm-sh/nvm))
- **npm** 10+
- Access to the WordPress instance (Local by Flywheel on this machine, or the live server)

---

## Local development

There are two modes depending on what you're working on.

### Mode A — UI only (most common)

Point the Next.js app at the **live server** for both config and state. No local services needed. Use this when working on screens, components, or styling.

```bash
cd next-app
npm install
npm run dev
```

Open `http://localhost:3000`.

The `.env.local` file must have:

```env
# WPGraphQL — use the live server or Local by Flywheel
NEXT_PUBLIC_WP_GRAPHQL_URL=https://192.168.1.91/graphql
WP_GRAPHQL_URL=http://127.0.0.1/graphql   # server-side only (if running locally on the WP machine)

# State service — point at the live server for real device data
STATE_API_BASE_URL=http://192.168.1.91:8081

# Auth
WP_AUTH_KEY=<matches AUTH_KEY in wp-config.php>
NEXTAUTH_SECRET=<any random string locally>
HCA_INTERNAL_KEY=<matches HCA_INTERNAL_KEY in wp-config.php>
REVALIDATE_SECRET=<any random string locally>
NEXT_PUBLIC_WP_HOME_URL=https://192.168.1.91

# WebAuthn — use localhost for local dev (no HTTPS needed)
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Home Control

# Spotify (optional — music screen only)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REFRESH_TOKEN=
SPOTIFY_REDIRECT_URI=
```

> **Note:** If `STATE_API_BASE_URL` is unset, the `/api/state`, `/api/stream`, and `/api/command` routes return 503. The app renders with config-seeded defaults and no live state updates.

---

### Mode B — Full local stack (state service + UI)

Run the state aggregator locally so you can test device commands end-to-end without touching the live server. Requires LAN access to the EISYs (`192.168.1.x`).

**Terminal 1 — state aggregator:**

```bash
cd home-control-services
npm install
```

Create `home-control-services/.env` (copy from `.env.example` if present):

```env
EISY_0_URL=http://192.168.1.10
EISY_1_URL=http://192.168.1.11
EISY_2_URL=http://192.168.1.12
EISY_3_URL=http://192.168.1.13
EISY_4_URL=http://192.168.1.14
EISY_USER=admin
EISY_PASS=<password>
POLL_MS=1000
PORT=8081
WP_GRAPHQL_URL=https://192.168.1.91/graphql
```

```bash
npm run dev
# Starts on http://127.0.0.1:8081
# Verify: curl http://127.0.0.1:8081/state | head -c 200
```

**Terminal 2 — Next.js:**

In `next-app/.env.local`, set:

```env
STATE_API_BASE_URL=http://127.0.0.1:8081
```

Then:

```bash
cd next-app
npm run dev
```

Open `http://localhost:3000`. Device toggles now send real commands to the EISYs.

---

### Exporting the device map from WordPress

The state aggregator uses `devices.json` to map WP device IDs to EISY addresses. Regenerate it after adding or changing devices in WordPress:

```bash
cd home-control-services
npm run export-devices
# Writes devices.json — commit this file
```

---

## WordPress theme (SCSS)

The Genesis child theme styles live in `scss/` and compile to `css/main.css`:

```bash
# In the theme root (not next-app/)
npm install
npm run sass:watch   # watch + compile on save
# or
npm run build        # one-off compile
```

`css/main.css` is gitignored — it's compiled on the server from source.

---

## Type checking

```bash
cd next-app
npm run type-check   # runs tsc --noEmit
```

---

## Production build

```bash
cd next-app
npm run build        # outputs to .next/
npm run start        # serves on port 3000 (pm2 handles this on the server)
```

---

## Deploying an update

```bash
# From the repo root on your Mac
git add <files>
git commit -m "..."
git push

# Then on the server (ssh in)
cd ~/homecontrolapp/next-app
git pull
npm install          # only needed if package.json changed
npm run build
pm2 restart hca-next --update-env
```

If only `home-control-services` changed (no UI rebuild needed):

```bash
cd ~/homecontrolapp
git pull
pm2 restart hca-state
```

---

## Live URLs

| | LAN | Public |
|---|---|---|
| **PWA** | `https://192.168.1.91:3443` | `https://app.dixons.net` |
| **WP admin** | `https://192.168.1.91/wp-admin` | LAN / VPN only |
| **GraphQL** | `https://192.168.1.91/graphql` | `https://app.dixons.net/graphql` |
| **State service** | `http://127.0.0.1:8081` | not exposed |
