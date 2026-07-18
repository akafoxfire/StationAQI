# Station/AQI — Live Air Quality Instrument Panel

A vanilla HTML/CSS/JS dashboard that reads live air quality data for any city
in the world, using the free [WAQI API](https://aqicn.org/api/).

## Features

- Search any city, or auto-detect your location
- Instrument-style semi-circle AQI gauge with color-coded zones
- Pollutant breakdown: PM2.5, PM10, O₃, NO₂, SO₂, CO, temperature, humidity
- Health advisory text based on current AQI level
- 7-day PM2.5 trend chart (Chart.js)
- Save stations locally (no login, uses `localStorage`) for quick re-reads
- Fully responsive, dark instrument-panel theme, no build step required

## 1. API token

Your WAQI token is already set in `script.js` (`CONFIG.token`). If you ever
need a new one, get it free and instantly at
**https://aqicn.org/data-platform/token/**.

## 2. Run locally

No build tools needed. Just open `index.html` in a browser, or serve it
with any static server, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## 3. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Station/AQI dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/aqi-tracker.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source → Deploy from branch → main → / (root)**.
Your app will be live at `https://<your-username>.github.io/aqi-tracker/`.

**After deploying, update the placeholder domain** (`YOUR-USERNAME.github.io/aqi-tracker`)
in these spots so SEO/social previews point to your real URL:
- `index.html` — `<link rel="canonical">`, `og:image`, `og:url`, `twitter:image`
- `robots.txt` — `Sitemap:` line
- `sitemap.xml` — `<loc>`

> ⚠️ Your WAQI token will be visible in the public JS file on GitHub Pages.
> WAQI's free tier is meant for exactly this (client-side, low-volume use)
> and tokens are free/disposable, so this is fine for a personal project.
> If you want to hide it later, proxy the request through a small serverless
> function (Cloudflare Worker / Vercel Edge Function / Firebase Cloud Function).

## Project structure

```
aqi-tracker/
├── index.html         # Structure + SEO meta tags, Open Graph, JSON-LD
├── style.css          # "Open Sky" design system (tokens, gauge, cards, responsive)
├── script.js          # API calls, gauge rendering, saved stations, Chart.js trend
├── manifest.json      # Web app manifest (installable, icons)
├── robots.txt         # Crawler rules + sitemap pointer
├── sitemap.xml        # Single-page sitemap
├── assets/
│   ├── favicon.svg           # Crisp logo shown in the browser tab (modern browsers)
│   ├── favicon.ico           # Legacy multi-resolution favicon
│   ├── favicon-16.png, favicon-32.png
│   ├── apple-touch-icon.png  # iOS home-screen icon
│   ├── icon-192.png, icon-512.png  # PWA/manifest icons
│   └── og-image.png          # Social share preview (WhatsApp, Twitter, etc.)
└── README.md
```

## Ideas to extend

- **Firebase sync**: replace `localStorage` saved-stations with Firestore so your
  saved cities follow you across devices (you already use this pattern in SalaryOS).
- **Push alerts**: Firebase Cloud Messaging notification when a saved city's AQI
  crosses "Unhealthy" — check hourly via a scheduled Cloud Function.
- **Offline caching**: add a service worker to cache the shell and last-known
  readings for offline access (the manifest is already in place for this).

## Data source

Air quality data is provided by the [World Air Quality Index (WAQI) Project](https://aqicn.org),
which aggregates real-time monitoring stations worldwide. Readings are indicative
and not a substitute for official government monitoring data.
