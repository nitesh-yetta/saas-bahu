# 🪷 Saas-Bahu Harmony — Deployment Guide

## What's in this folder

```
saas-bahu-app/
├── api/
│   └── chat.js          ← Secure server (your API key lives here only)
├── public/
│   └── index.html       ← The full app (EN + Hindi, AI-powered)
├── vercel.json          ← Hosting configuration
├── .env.example         ← Template — copy this to .env.local
├── .gitignore           ← Keeps your key out of GitHub
└── README.md            ← This file
```

---

## Deploy in 10 minutes (free)

### Step 1 — Get your Anthropic API key
1. Go to https://console.anthropic.com
2. Sign in → **API Keys** → **Create Key**
3. Copy the key (looks like: `sk-ant-api03-...`)

---

### Step 2 — Upload to GitHub
1. Go to https://github.com → **New Repository**
2. Name it: `saas-bahu-harmony`
3. Upload all files from this folder
4. **IMPORTANT:** Do NOT upload `.env.local` — it's blocked by `.gitignore`

---

### Step 3 — Deploy on Vercel (free)
1. Go to https://vercel.com → **Sign up with GitHub**
2. Click **Add New Project**
3. Select your `saas-bahu-harmony` repository
4. Click **Deploy**

---

### Step 4 — Add your API key securely
1. In Vercel → your project → **Settings** → **Environment Variables**
2. Add this:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-your-key-here`
   - **Environment:** Production, Preview, Development ✓ all three
3. Click **Save**
4. Go to **Deployments** → click the three dots → **Redeploy**

✅ Your app is live! Share the Vercel URL anywhere.

---

### Step 5 — Add a custom domain (optional, ~$10/year)
1. Buy a domain at https://namecheap.com (e.g. `saasbahuharmony.com`)
2. In Vercel → **Settings** → **Domains** → add your domain
3. Follow the DNS instructions (takes ~10 minutes to go live)

---

## How the security works

```
User's phone
    ↓  calls /api/chat  (no API key visible)
Your Vercel server
    ↓  adds API key from environment variable (secret, encrypted)
Anthropic Claude API
    ↓  sends response back
User's phone
```

The API key **never** appears in the browser, in URLs, or in any log the user can see.

---

## Cost estimate

| Users per day | Conversations | Approx. cost |
|---|---|---|
| 100 | 100 | ~$0.03/day |
| 1,000 | 1,000 | ~$0.30/day |
| 10,000 | 10,000 | ~$3.00/day |
| 100,000 | 100,000 | ~$30.00/day |

Vercel hosting: **Free** up to 100GB bandwidth/month.

---

## Add more languages (future)

The translation system in `index.html` uses a simple `T` object.
To add Marathi, Tamil, Telugu, or Gujarati:
1. Copy the `en` block in the `T` object
2. Rename it to `mr` / `ta` / `te` / `gu`
3. Translate each string
4. Add a language button in the header
Claude will automatically respond in the right language based on the system prompt.

---

## Support

Built with Claude (Anthropic). For questions about the app, open a GitHub Issue.
