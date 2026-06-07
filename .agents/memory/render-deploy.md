---
name: Render deploy build sequence
description: Required steps after every frontend change to keep render-app in sync for production Render deployment
---

## Rule
After every frontend change (any edit to `artifacts/pos-dashboard/src/`), run the full render-app rebuild sequence before finishing.

**Why:** Render serves from `render-app/public/` (pre-built static files) and `render-app/dist/server.mjs`. The dev workflow auto-rebuilds the dev server but never updates these files. Without this step, the Render-deployed app is always stale.

## How to apply
Run these three commands in order after any frontend change:

```bash
# 1. Rebuild the SPA
PORT=18295 BASE_PATH=/ pnpm --filter @workspace/pos-dashboard run build

# 2. Copy fresh dist into render-app
rm -rf render-app/public/* && cp -r artifacts/pos-dashboard/dist/public/. render-app/public/

# 3. Rebuild the server bundle
cd render-app && npm run build
```

Or as a one-liner from workspace root:
```bash
PORT=18295 BASE_PATH=/ pnpm --filter @workspace/pos-dashboard run build && rm -rf render-app/public/* && cp -r artifacts/pos-dashboard/dist/public/. render-app/public/ && cd render-app && npm run build
```

Then commit — Render auto-deploys on push.
