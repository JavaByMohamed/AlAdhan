# AlAdhan Daily Prayer Times Preview

A simple front-end app that shows today's prayer times for:

- Fajr
- Sunrise
- Dhuhr
- Asr
- Maghrib
- Isha

It now uses a local timetable file sourced from **Islamiska Förbundet**:

- Source: https://www.islamiskaforbundet.se/bonetider/
- Live public file: `data/islamiskaforbundet-bonetider.live.json` (runtime-updated in production)
- Seed fallback file: `data/islamiskaforbundet-bonetider.json`

If a selected date is missing from that local timetable, prayer times are not loaded and an error is shown.

You can also manually set prayer times for any selected date from the UI.
Manual values are saved in your browser and override timetable values for that date until cleared.

## Run

Open `index.html` in your browser.

The app is configured with a Stockholm-specific profile to align with local published timetable behavior.

When you run the app with `npm start`, it:
1. Syncs `data/islamiskaforbundet-bonetider.live.json` once at startup.
2. Syncs again automatically every day at **00:00 (Europe/Stockholm)** while the server is running.

The source table normally includes the rest of the month, which gives at least one week ahead in practice.

The sync compares new times with the current live JSON and only rewrites the live file when values changed.

## GitHub Pages automation

For GitHub Pages deployments, use `.github/workflows/sync-bonetider.yml`.
It runs daily at Stockholm midnight, updates `data/islamiskaforbundet-bonetider.live.json`,
and pushes changes automatically so Pages picks up the new times without manual deploys.

## Keep timetable synced with the source site

Run:

```bash
npm run sync:bonetider
```

Optional month/year (defaults to current month/year in Stockholm):

```bash
node ./scripts/sync-islamiska-times.mjs 8 2026
```
