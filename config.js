// config.js — runtime configuration for claude-chat
// This file is intentionally committed. It contains no secrets.
// The PROXY_URL points to the Cloudflare Worker which holds the real API key.

window.APP_CONFIG = {
  // Cloudflare Worker proxy — handles OpenRouter API calls server-side
  PROXY_URL: 'https://dark-feather-5042.insightfulscroll.workers.dev',

  // App metadata
  APP_NAME:    'Claude Chat',
  APP_VERSION: '2.0.0',
};
