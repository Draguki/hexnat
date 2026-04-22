# HexNeedle Analytics — Deployment Guide

Complete walkthrough: **Supabase → GitHub → Vercel → SITE123 inject**

---

## Project Structure

```
hexneedle-analytics/
├── app/
│   ├── layout.jsx              ← Root layout (required by Next.js 14)
│   ├── page.jsx                ← Redirects to /dashboard
│   ├── dashboard/
│   │   └── page.jsx            ← Analytics dashboard UI
│   └── api/
│       └── track/
│           └── route.js        ← Ingest API (POST /api/track)
├── public/
│   └── tracking-script.js      ← Client-side tracker (static file)
├── supabase-schema.sql         ← Run this once in Supabase
├── package.json
├── next.config.js
├── .env.local.example          ← Copy to .env.local, fill in keys
└── .gitignore
```

---

## Step 1 — Supabase

1. Go to **https://supabase.com** → **New Project**
   - Name: `hexneedle-analytics`
   - Region: `ap-south-1` (Mumbai — lowest latency from India)
   - Password: generate a strong one and save it

2. Once created, go to **SQL Editor → New Query**

3. Paste the entire contents of `supabase-schema.sql` and click **Run**
   You should see: `Success. No rows returned.`

4. Go to **Settings → API** and copy these values:
   | Value | Where it goes |
   |---|---|
   | Project URL | `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` |
   | `anon` / `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | `service_role` key | `SUPABASE_SERVICE_KEY` — **never expose client-side** |

---

## Step 2 — GitHub

```bash
# 1. Create a new repository on github.com (name: hexneedle-analytics)
#    Make it PRIVATE if it contains any secrets (it shouldn't — .env.local is gitignored)

# 2. In your project folder:
git init
git add .
git commit -m "Initial commit — HexNeedle Analytics"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hexneedle-analytics.git
git push -u origin main
```

---

## Step 3 — Vercel

### 3a. Import from GitHub
1. Go to **https://vercel.com** → **Add New Project**
2. Click **Import** next to your `hexneedle-analytics` repo
3. Framework Preset: **Next.js** (auto-detected)
4. Root Directory: leave as `./`
5. **Do NOT deploy yet** — add env vars first

### 3b. Add Environment Variables
In Vercel → Project Settings → **Environment Variables**, add all six:

| Name | Value | Environments |
|---|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `ALLOWED_ORIGIN` | `https://www.hexneedle.com` | Production |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | Development |

> ⚠️ `SUPABASE_SERVICE_KEY` is a secret. Set it only in Production (not Preview) if you're worried about it leaking via Vercel preview URLs.

### 3c. Deploy
Click **Deploy**. Vercel will:
1. Install dependencies (`npm install`)
2. Build (`next build`)
3. Deploy to `https://hexneedle-analytics.vercel.app`

Your endpoints will be:
- **Dashboard:** `https://hexneedle-analytics.vercel.app/dashboard`
- **API:** `https://hexneedle-analytics.vercel.app/api/track`
- **Tracking script:** `https://hexneedle-analytics.vercel.app/tracking-script.js`

---

## Step 4 — Update the Tracking Script URL

Open `public/tracking-script.js` and confirm this line matches your Vercel URL:

```javascript
var API_ENDPOINT = "https://hexneedle-analytics.vercel.app/api/track";
```

If your Vercel project was given a different name, update this, commit, and push:
```bash
git add public/tracking-script.js
git commit -m "Update API endpoint URL"
git push
```
Vercel auto-redeploys on every push to `main`.

---

## Step 5 — Inject into SITE123

1. Log into SITE123 → Your site → **Manage**
2. Go to **Settings → Advanced → Header / Footer Code**
3. In the **Header** section, paste:

```html
<!-- HexNeedle Analytics -->
<script src="https://hexneedle-analytics.vercel.app/tracking-script.js" async defer></script>
```

4. Click **Save**

### Verify it's working
1. Open your site in a browser
2. Open **DevTools → Network tab**
3. Filter by `track` — you should see a POST to `/api/track` returning `200`
4. Open **Supabase → Table Editor → events** — new rows should appear within seconds

---

## Step 6 — Verify CORS

The tracking script uses `credentials: "include"` which requires:
1. `Access-Control-Allow-Origin: https://www.hexneedle.com` (exact origin, not `*`)
2. `Access-Control-Allow-Credentials: true`

Both are set in `app/api/track/route.js` using the `ALLOWED_ORIGIN` env var.

To test in DevTools:
- **Console:** no CORS errors
- **Network → /api/track → Response Headers:** confirm both headers are present

---

## Step 7 — Conflict Check with Existing Plugins

| Existing plugin | Concern | Status |
|---|---|---|
| Meta Pixel (`fbq`) | Global var collision | ✅ Safe — IIFE, never touches `fbq` |
| Plugin 2 localStorage `orderData` | Key collision | ✅ Safe — analytics uses `hxa_` prefix |
| Plugin 3/4 `hexneedle_amount` | Key collision | ✅ Safe — different key |
| Plugin 5 `purchase_tracked` | sessionStorage collision | ✅ Safe — analytics uses `hxa_utm` |
| SITE123 form handler | `preventDefault` interference | ✅ Safe — analytics never calls `preventDefault` |

---

## Ongoing Maintenance

- **Automatic deploys:** Every `git push origin main` triggers a Vercel redeploy
- **Database growth:** Events table gains ~1 row per user interaction. At 1,000 visitors/day you'll accumulate ~50,000 rows/day. The optional `pg_cron` cleanup job in `supabase-schema.sql` deletes rows older than 90 days
- **Supabase free tier:** 500MB database, 2GB bandwidth — plenty for a small ecommerce site

---

## Local Development

```bash
# 1. Clone your repo
git clone https://github.com/YOUR_USERNAME/hexneedle-analytics.git
cd hexneedle-analytics

# 2. Install dependencies
npm install

# 3. Copy env template
cp .env.local.example .env.local
# Fill in the values in .env.local

# 4. Run dev server
npm run dev
# Dashboard: http://localhost:3000/dashboard
# API: http://localhost:3000/api/track
```
