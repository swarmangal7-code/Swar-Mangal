# Deploying Swar Mangal to aaPanel VPS

```
Flutter APK ─────────────HTTPS──┐
                                 ├──> Nginx (aaPanel) ──> app (PM2 / Next.js /api/rpc) ──> PostgreSQL (aaPanel DB)
Public website (Cloudflare Pages, CORS)                                            │
                                          sheets-worker (PM2) <── sheet_outbox ──> Google Sheets mirror
```

- **App + Sheets worker**: PM2 via aaPanel's Node.js manager
- **PostgreSQL**: aaPanel's database panel
- **Nginx**: aaPanel's site manager
- **Public website**: static export on Cloudflare Pages, calling this VPS's
  `/api/rpc` directly — see §10 below
- **WhatsApp gateway**: Docker (only service that needs Docker)

## 1. Prerequisites

- aaPanel installed on Ubuntu/Debian VPS (https://www.aapanel.com)
- Git installed (aaPanel → App Store → Git)
- Domain DNS pointing to the VPS IP

## 2. First deploy

```bash
ssh root@<vps-ip>
cd /opt
git clone https://github.com/swarmangal7-code/Swar-Mangal.git
cd Swar Mangal/deploy/aapanel
chmod +x setup.sh && ./setup.sh
```

The script installs Node.js 22, PM2, builds the app, and starts two PM2 processes.

## 3. Configure the database

1. aaPanel → Databases → Add Database
   - Database name: `swarmangal`
   - User: `swarmangal`
   - Password: (generate with `openssl rand -hex 24`)
2. Edit `/opt/swarmangal/.env` and set `DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://swarmangal:<password>@127.0.0.1:5432/swarmangal
   ```
3. Restart: `pm2 restart swarmangal-app`

The app auto-applies schema on first start (`db/apply.mjs` runs via `prestart`).

## 4. Configure Nginx

1. aaPanel → Website → Add Site → enter your domain (e.g. `swarmangal.in`)
2. After creation → Settings → Config File → replace contents with `deploy/aapanel/nginx.conf`
3. Enable SSL → Let's Encrypt → issue certificate

## 5. Environment variables

Edit `/opt/swarmangal/.env` (copy from `deploy/.env.example`):

```bash
# Required
DATABASE_URL=postgresql://swarmangal:<password>@127.0.0.1:5432/swarmangal
RPC_FOUNDER_TOKEN=$(openssl rand -hex 32)
RPC_STAFF_TOKEN=$(openssl rand -hex 32)
RPC_STAFF_BRANCHES=KANDIVALI
SESSION_SECRET=$(openssl rand -hex 32)

# Public address (used for terms links, redirects)
APP_DOMAIN=swarmangal.in

# Optional: Google Sheets mirror
SHEETS_MIRROR_SPREADSHEET_ID=
# Google service account key: /opt/swarmangal/secrets/google-service-account.json

# Optional: Email OTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=

# Optional: Push notifications
FIREBASE_SERVICE_ACCOUNT_JSON=

# Optional: Teacher payouts
PAYOUT_EARNING_BASE=
```

## 6. Verify

```bash
curl -s -X POST https://swarmangal.in/api/rpc -d 'function=api_dashboard&token=wrong'
# -> {"ok":false,"code":"AUTH_FAILED",...}

pm2 status
pm2 logs swarmangal-app --lines 20
```

## 7. WhatsApp (optional)

Uses Docker for the WA-AKG gateway only.

```bash
cd /opt/swarmangal/deploy
# Fill WA_* values in .env
docker compose up -d --build wa-db wa-akg
```

Dashboard access via SSH tunnel:
```bash
ssh -L 3080:127.0.0.1:3080 root@<vps-ip>
# Open http://localhost:3080 in browser
```

Setup:
1. **Sessions** → create session → scan QR with academy phone (WhatsApp → Linked devices)
2. **API Keys** → create key → put in `.env` as `WA_AKG_API_KEY`
3. **Webhooks** → URL `http://host.docker.internal:3000/api/wa/webhook`, secret = `WA_WEBHOOK_SECRET`, event `message.status`
4. Set `WA_SEND_ENABLED=true`, restart app: `pm2 restart swarmangal-app`

## 8. Push notifications (optional)

1. Create Firebase project → register Android app (package: `in.swarmangal.academyos`)
2. Download `google-services.json` → put at `android/app/google-services.json` → rebuild APK
3. Create service account key → base64 encode → set as `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`
4. `pm2 restart swarmangal-app`
5. Sign in on phone → allow notification permission

Daily fees digest cron:
```
0 9 * * * curl -s -X POST https://swarmangal.in/api/rpc -d function=api_founder_sendDailyDigest -d token=$RPC_FOUNDER_TOKEN >/dev/null
```

## 9. Self-service token registration (optional)

Founder and staff can register their own device tokens via email OTP.

1. Set `SMTP_USER` (Gmail address) and `SMTP_PASS` (App Password, not normal password) in `.env`
2. `pm2 restart swarmangal-app`
3. **Staff must be added to the allow-list first**: app → Home → About → "Manage staff access" → add email
4. Test: app → login → gear icon → "Set up my token" → enter email → check code → auto-login

Lost phone? Founder → "Manage staff access" → find device → Revoke. Staff can then self-register via "Forgot / reset my token".

## Day to day

| Task | Command |
|---|---|
| Check app status | `pm2 status` |
| App logs | `pm2 logs swarmangal-app` |
| Sheets worker logs | `pm2 logs swarmangal-sheets` |
| Restart app | `pm2 restart swarmangal-app` |
| Update after git pull | `cd /opt/swarmangal && git pull && npm run build && pm2 restart swarmangal-app swarmangal-sheets` |
| Nightly backup | cron: `15 2 * * * /opt/swarmangal/deploy/aapanel/backup.sh >> /var/log/swarmangal/backup.log 2>&1` |
| Restore backup | `pg_restore -h 127.0.0.1 -U swarmangal -d swarmangal --clean < /opt/swarmangal/backups/<file>.dump` |
| Is WhatsApp connected? | `curl -s -H "X-API-Key: $WA_AKG_API_KEY" http://127.0.0.1:3080/api/sessions/$WA_AKG_SESSION_ID` |
| Stop WhatsApp sending | set `WA_SEND_ENABLED=false` in `.env`, `pm2 restart swarmangal-app` |
| Send fees digest now | `curl -s -X POST https://swarmangal.in/api/rpc -d function=api_founder_sendDailyDigest -d token=$RPC_FOUNDER_TOKEN` |
| List device tokens | `curl -s -X POST https://swarmangal.in/api/rpc -d function=api_founder_listStaffTokens -d token=$RPC_FOUNDER_TOKEN` |
| Old token mint | `node db/mint_device_token.mjs "<label>" <FOUNDER_ADMIN\|OPS_USER>` |

## 10. Public website (Cloudflare Pages)

The public site + founder/staff/student/parent/teacher web dashboards
(`src/app/`, everything outside `/api`) deploy separately as a static export
on Cloudflare Pages, calling the VPS's `/api/rpc` directly cross-origin (the
route already sends permissive CORS headers — see `src/app/api/rpc/route.ts`).
The VPS itself never serves this static build; `npm run build` there only
needs `/api/*` up for the Flutter app and any dev use of the same-origin site.

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect this repo
2. Build command: Cloudflare's own project settings, not this repo's
   `package.json`, decide what actually runs — it has been observed running
   `npx @cloudflare/next-on-pages` directly (ignoring `npm run pages:build`
   entirely). **Both are safe** — see the `CF_PAGES` mechanism below — but
   `npm run pages:build` is the one that also works for local testing.
   Build output directory: `.vercel/output/static` (already set in
   `wrangler.toml`).
3. **Required build-time env var** (Pages → Settings → Environment variables):
   ```
   NEXT_PUBLIC_RPC_URL=https://swarmangal.in/api/rpc
   ```
   Without this the static site falls back to calling itself at same-origin
   `/api/rpc`, which doesn't exist on Pages (no server functions there) — the
   whole site's RPC calls would just fail.
4. Deploy. Cloudflare rebuilds automatically on every push to `main`.

### Why `src/app/api` never reaches the Cloudflare build

A static export can't contain server API routes at all, and every route
under `src/app/api` genuinely needs the Node.js runtime (they use `pg` for
raw Postgres TCP connections, which Cloudflare's Edge Runtime cannot do) —
so `next-on-pages` refuses the build outright if it sees them
("routes were not configured to run with the Edge Runtime").

Since Cloudflare's own dashboard build command can't be relied on to run our
`pages:build` script (see above), the actual fix lives in a `prebuild` npm
hook, which fires automatically before **any** invocation of `npm run build`
— including the one `next-on-pages` itself runs internally — regardless of
what command started it:

```
"prebuild": "node -e \"if(process.env.CF_PAGES){require('fs').rmSync('src/app/api',{recursive:true,force:true})}\""
```

`CF_PAGES` is a build-time env var Cloudflare Pages sets automatically on
every build, however it was triggered. On the VPS (`CF_PAGES` unset) this is
a no-op — `/api/*` stays intact for the real Node server. `npm run
pages:build`'s own `rm -rf src/app/api` is kept too, purely so a developer
testing this build locally (where `CF_PAGES` is never set) still exercises
the same Cloudflare-shaped build.

## Architecture rules

- **Postgres is source of truth.** Sheets mirror can be rebuilt from it; Postgres cannot from Sheets.
- **One worker at a time.** A database advisory lock enforces this.
- **Sheets mirror is one-direction.** Edits in the sheet are overwritten on next change.
- **Device tokens**: env tokens (non-revocable without redeploy) + DB tokens (revocable on the spot). Prefer DB tokens via OTP flow.
- **Branch isolation**: staff see only branches in `RPC_STAFF_BRANCHES`. Unset = nothing (fail closed).
