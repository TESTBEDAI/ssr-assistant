# SSR Rules Assistant — GitHub Pages deployment

Two pieces:

1. **index.html** — the app. Contains the full text of both Jan 2026 rulebooks
   (New SSR V2.0 Parts 1–8 + legacy SSR V8.0) and the retrieval logic. Static,
   safe to host publicly. Contains no secrets.
2. **worker.js** — a Cloudflare Worker that holds your Anthropic API key and
   forwards questions to the API. The key never appears in the public page.

## Part A — Anthropic API key (~5 min)

1. Go to https://console.anthropic.com and sign in / sign up.
2. Add a payment method under Settings → Billing (required before requests work).
3. Settings → API keys → Create Key. Name it `ssr-rules-proxy`.
4. Copy the key (starts `sk-ant-...`). It is shown only once.
5. Recommended: Settings → Limits, set a monthly spend limit (e.g. $10).
   A typical question costs a fraction of a cent; even heavy club use is dollars/month.

## Part B — Cloudflare Worker (~10 min)

1. Sign up at https://dash.cloudflare.com (free plan is fine — 100,000 requests/day).
2. Compute (Workers) → Create → Create Worker (Hello World template).
   Name it `ssr-rules-proxy` → Deploy.
3. Click "Edit code", delete the placeholder, paste in the contents of
   `worker.js`, and check `ALLOWED_ORIGINS` matches your Pages site
   (default: https://lyndhurstrc.github.io). Deploy.
4. Back on the Worker's page: Settings → Variables and Secrets → Add:
   - Type: **Secret**
   - Name: `ANTHROPIC_API_KEY`  (exactly this, case-sensitive)
   - Value: your `sk-ant-...` key
   Save/deploy.
5. Copy the Worker URL from the overview page, e.g.
   `https://ssr-rules-proxy.yourname.workers.dev`

## Part C — Configure and publish the app (~5 min)

1. Open `index.html` in a text editor. Near the top of the `<script>` block find:

       const PROXY_URL = "PASTE-YOUR-WORKER-URL-HERE";

   Paste your Worker URL between the quotes (no trailing slash).
2. Create a repo in the LyndhurstRC org (e.g. `ssr-assistant`), add `index.html`
   (and this file + worker.js for reference), push.
3. Repo Settings → Pages → Deploy from branch → main → / (root) → Save.
4. App appears at `https://lyndhurstrc.github.io/ssr-assistant/` after a minute or two.

## Testing locally before pushing

Browsers send `Origin: http://localhost:8000` from a local server (and no
usable origin at all from a `file://` open), so temporarily uncomment the
localhost line in `ALLOWED_ORIGINS` in the Worker, redeploy, then:

    python3 -m http.server 8000    # in the folder containing index.html

Open http://localhost:8000, ask a question. Re-comment the localhost line when done.

## Notes on abuse and cost

- The Worker only accepts requests from your listed origin, forces the model,
  caps output tokens, and caps request size. The origin check deters casual
  misuse but is not cryptographic — the real backstop is the spend limit you
  set in the Anthropic console.
- Updating the rulebook next January: regenerate index.html from the new PDFs
  (the extraction/chunking is scripted); the Worker never changes.
