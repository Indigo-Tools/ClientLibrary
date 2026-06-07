# Nyxora AI — setup (Cloudflare Worker proxy)

The site is static (GitHub Pages), so the browser can **never** safely hold the Gemini key.
A tiny Cloudflare Worker keeps the key server-side; the site calls the Worker.

## 1. Get a fresh API key
The key shared earlier in chat is compromised — **revoke it** and create a new one:
- https://aistudio.google.com/app/apikey → *Create API key*

## 2. Deploy the Worker

### Option A — Dashboard (no tooling)
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it e.g. `nyxora-ai`, **Deploy**, then **Edit code**.
3. Paste the contents of [`gemini-worker.js`](gemini-worker.js), **Save and deploy**.
4. Worker → **Settings → Variables and Secrets** → **Add** → type **Secret**:
   - Name: `GEMINI_API_KEY`
   - Value: *your new key* → **Save**.

### Option B — Wrangler CLI
```bash
npx wrangler deploy gemini-worker.js --name nyxora-ai
npx wrangler secret put GEMINI_API_KEY   # paste the key when prompted
```

## 3. Connect the site
Copy your Worker URL (e.g. `https://nyxora-ai.<your-subdomain>.workers.dev`) and set it in
[`script.js`](script.js):

```js
const GEMINI_PROXY_URL = 'https://nyxora-ai.<your-subdomain>.workers.dev';
```

Commit & push. The ⨳ button (bottom-right) opens the chat.

## Notes
- The key lives only as a Worker **secret** — never in this repo or the browser.
- Edit `ALLOWED_ORIGINS` in `gemini-worker.js` if your domain changes; add your Pages
  preview origin there too if needed.
- Change the model via `MODEL` in `gemini-worker.js` (default `gemini-2.5-flash`).
- Responses stream via Server-Sent Events for a live typing effect.
