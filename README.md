# Swar Mangal — Music Academy Management Platform

Premium music class management platform for students, teachers, and academies.

## Production stack

```
[ Flutter Android APK ]  --HTTPS RPC-->  [ Railway backend: Next.js / Node.js /api/rpc ]
                                              |
                                              | PostgreSQL
                                              v
                                       [ production database ]
```

- **Native client**: Flutter Android app (`lib/`).
- **Backend**: Next.js / Node.js deployed on Railway.
- **Database**: PostgreSQL (managed by Railway).
- **RPC**: `POST /api/rpc` — `function`, `token`, `arg` form fields, JSON response.
- **Auth**: Founder/Staff device tokens; backend-authoritative.
- **Branch isolation**: staff see only the branches in `RPC_STAFF_BRANCHES`
  (unset = nothing); every handler checks the branch stored on the record.
- **Zero Google Apps Script**: no `script.google.com`, no `/exec`, no Google Sheets.

Deployment URL: `https://swarmangal-app-production.up.railway.app/api/rpc`.

## Features

**Founder / Staff app surfaces**
- Daily ops: today's classes, attendance roster + marking, fee reminders, inquiries.
- Students: search, add, drafts, profiles, fee status, receipts (finalisation is
  founder-gated).
- Finance: cashbook, expenses (staff drafts / founder records), teacher payouts,
  school invoices, payment drafts + approvals.
- Teachers: list, add, profile, compensation, status.
- Sync: revision-based near-real-time synchronization of changed entities.

## Tech stack (Flutter)

- Flutter + Material design, custom Swar Mangal theme (`lib/core/theme.dart`).
- `http` for the RPC client, `provider` for state, `shared_preferences` for
  non-sensitive settings, `flutter_secure_storage` for the device token.
- `pdf` + `printing` for receiving/invoice document generation.

## Quick start (Flutter)

```bash
flutter pub get
flutter run          # connect a device or emulator, or use in-app Demo mode
```

Login with a device token (founder/staff) against the deployed gateway, or use
**Demo · Founder / Demo · Staff** for an offline preview (memory only, never
persisted).

## Configuration

- Production RPC URL: `lib/config.dart` (`founderExecUrl` / `staffExecUrl`).
- Custom gateway URL: login screen gear icon (validated: `https` + `/api/rpc`,
  rejects placeholders and legacy Google URLs).
- Device token: stored in secure storage (`lib/core/session_storage.dart`).

## Backend

See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for setup, environment variables,
RPC contract, authorization policy, and database management.

```bash
npm install
npm run typecheck
npm run build
```

## Build APK

```bash
flutter build apk --release
```

Releases are signed with the committed shared debug key
(`build-keys/debug.jks`, standard `android` passwords) — deliberately, no
private keystore anywhere in this pipeline, so any machine cuts
byte-identical releases and a lost key can never strand updates again.
Internal sideload distribution only (own server, in-app updater); never
the Play Store. Never replace that file. Publish by uploading the APK to
`/opt/swarmangal/public/downloads/swar-mangal.apk` and bumping
`version.json` (`versionCode` above whatever is installed).

## Test

```bash
flutter test
node --experimental-strip-types --test backend-tests/*.test.ts
```