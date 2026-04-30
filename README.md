# AI Chat — Free OpenRouter Models

A clean, modular chat app using **OpenRouter's free models**. Zero cost per message.

## 🚀 Quick Start

### Run Locally
```bash
# Option 1: Python (no install needed)
cd claude-chat-v2
python3 -m http.server 8000
# Open http://localhost:8000

# Option 2: Just open index.html directly in browser
open index.html
```

### Deploy Free on GitHub Pages
```bash
git init
git add .
git commit -m "AI chat app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-chat.git
git push -u origin main
# Then: Settings → Pages → Source: Deploy from branch → main / (root)
# Live at: https://YOUR_USERNAME.github.io/ai-chat/
```

### Deploy Free on Netlify
Drag and drop the `claude-chat-v2/` folder to https://app.netlify.com/drop

## 🔑 Getting Your Free OpenRouter Key
1. Go to https://openrouter.ai/keys
2. Sign up (free, no credit card for free models)
3. Create a key
4. Paste it into the sidebar of this app

## 📁 File Structure
```
claude-chat-v2/
├── index.html          ← App shell (HTML structure only)
├── assets/
│   ├── style.css       ← All design tokens, dark/light mode, components
│   └── app.js          ← All logic: API calls, streaming, file handling, history
└── README.md
```

## ✨ Features
- 20+ free models (NVIDIA Nemotron, DeepSeek R1, Llama 4, Gemma 4, Qwen3…)
- Real streaming responses (SSE)
- File attachments: images, .py, .js, .csv, .json, .sql, .md and more
- Drag & drop files + paste images from clipboard
- Multi-session chat history
- Session stats: token estimate, context bar, response time
- Dark / light mode toggle
- Export any chat as Markdown
- System prompt customizable per session
- Mobile responsive

## 🔒 Privacy
Your API key never leaves your browser. It's stored in memory only (no localStorage).
