# ClaudeChat — Free Claude via Puter.js

A clean, modular chat UI using [Puter.js](https://puter.com) to access Claude models **for free** — no API key, no backend, no cost to you.

## How It Works

Puter uses a **"User-Pays" model**: your users authenticate with their own Puter account, and Puter covers their AI usage costs. As a developer, you pay **nothing**.

- ✅ Free for developers to deploy
- ✅ No API keys needed
- ✅ Supports Claude Sonnet 4.6, Opus 4.7, Haiku 4.5 and more
- ✅ Streaming responses
- ✅ Chat history (in-memory per session)
- ✅ Light + Dark mode

## File Structure

```
puter-claude-chat/
├── index.html        ← App shell (HTML structure only)
├── assets/
│   ├── style.css     ← All styling (design tokens, layout, components)
│   └── app.js        ← All logic (state, Puter API calls, rendering)
└── README.md
```

## Run Locally

Just open `index.html` in any browser — no build step required.

```bash
# Option 1: Open directly
open index.html

# Option 2: Serve with Python (avoids any CORS issues)
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Deploy to GitHub Pages (Free Hosting)

1. Create a GitHub repo (can be private or public)
2. Push all files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to repo **Settings → Pages → Source → Deploy from branch → main / root**
4. Your app is live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Available Models

| Model | Speed | Intelligence |
|---|---|---|
| `claude-sonnet-4-6` | Fast | High ⭐ Recommended |
| `claude-opus-4-7` | Slow | Highest |
| `claude-haiku-4-5` | Fastest | Good |
| `claude-opus-4-6` | Slow | Very High |
| `claude-3-7-sonnet` | Fast | High |
| `claude-3-5-sonnet` | Fast | High |

## Important Caveats

- Users need a **Puter account** for sustained use — anonymous usage may have lower rate limits
- Puter could change pricing or availability — monitor [puter.com](https://puter.com)
- Not suitable for backend/server-side code (Puter.js is browser-only)
- Chat history is **in-memory only** — refreshing the page clears it (add localStorage if needed)
