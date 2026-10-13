# Shared debug signing key — committed on purpose

`debug.jks` (alias `androiddebugkey`, passwords `android`) signs every
release APK. Founder decision: no private keystore anywhere in this
pipeline, so any machine cuts byte-identical releases and a lost key can
never strand updates again.

Rules:
- Internal sideload distribution ONLY (own server, in-app updater).
  These APKs can never go to the Play Store.
- Anyone with repo access can sign updates the app accepts. That is the
  accepted trade-off.
- NEVER replace this file: changing it breaks updates for every
  installed app, forcing another reinstall migration.
