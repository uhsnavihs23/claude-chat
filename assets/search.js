// assets/search.js — web search context injection
// Loaded before app.js. Exposes window.AppSearch

(function () {

  // ── Config ─────────────────────────────────────────────────────────────
  // Read proxy URL from config.js (APP_CONFIG) or fall back to the
  // hardcoded value in app.js. We delay reading until first call so
  // config.js has time to set window.APP_CONFIG.
  function getEndpoint() {
    return window.APP_CONFIG?.PROXY_URL
      || 'https://dark-feather-5042.insightfulscroll.workers.dev';
  }

  const MAX_RESULTS   = 5;    // max results to inject into context
  const MIN_QUERY_LEN = 12;   // ignore very short queries

  // ── Trigger patterns (search IS likely needed) ──────────────────────────
  const SEARCH_TRIGGERS = [
    // time-sensitive keywords
    /\b(today|tonight|yesterday|this week|this month|this year|right now|currently|latest|recent|now|2024|2025|2026)\b/i,
    // news / live data
    /\b(news|weather|price|stock|share price|score|result|winner|election|release|update|version|launch|announced|breaking)\b/i,
    // factual lookup phrasing
    /\b(who is|what is|when did|when was|where is|how much|is it|will it|has .+? happened|did .+? happen)\b/i,
    // explicit search intent
    /\b(search|look up|find out|google|check online|browse|internet|web|online)\b/i,
    // ends with a question mark (factual questions)
    /\?\s*$/,
  ];

  // ── Skip patterns (search NOT useful) ───────────────────────────────────
  const NO_SEARCH_PATTERNS = [
    // creative / generative tasks
    /^(write|create|generate|make|build|draft|compose|design)/i,
    // coding tasks
    /^(code|fix|debug|refactor|explain this|translate|summarise|summarize|list|give me|show me|help me write|convert this)/i,
    // looks like code
    /^(def |function |class |import |from |SELECT |INSERT |UPDATE |DELETE |<html|{|})/,
    // math / algorithmic
    /\b(regex|algorithm|function|script|formula|equation|calculate|compute|convert|parse)\b/i,
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────

  function shouldSearch(text) {
    if (!text || text.trim().length < MIN_QUERY_LEN) return false;
    if (NO_SEARCH_PATTERNS.some(p => p.test(text.trim())))  return false;
    return SEARCH_TRIGGERS.some(p => p.test(text));
  }

  function formatResultsAsContext(results, query) {
    if (!results?.length) return '';

    const lines = [
      `## Web Search Results`,
      `**Query:** "${query}"`,
      `**Retrieved:** ${new Date().toUTCString()}`,
      '',
    ];

    results.forEach((r, i) => {
      lines.push(`**[${i + 1}] ${r.title || 'Untitled'}**`);
      if (r.snippet) lines.push(r.snippet.trim());
      if (r.url)     lines.push(`Source: ${r.url}`);
      lines.push('');
    });

    lines.push(
      '---',
      'Use the above search results to inform your answer.',
      'Cite sources inline where relevant (e.g. "According to [1]…").',
      'If the results are insufficient or outdated, say so clearly.'
    );

    return lines.join('\n');
  }

  // Clean + shorten query for the search API
  // (strip filler words, trim to 120 chars)
  function buildSearchQuery(text) {
    return text
      .replace(/^(can you |please |could you |would you |i want to know |tell me )/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  // ── Main Search object ───────────────────────────────────────────────────

  const Search = {

    /**
     * Returns true if the query looks like it needs a live web search.
     */
    needsSearch(text) {
      return shouldSearch(text);
    },

    /**
     * Performs the search via the Cloudflare Worker /search endpoint.
     * Returns { results, source, query } or null on failure.
     */
    async query(text, num = MAX_RESULTS) {
      const endpoint = getEndpoint();
      if (!endpoint) {
        console.warn('[AppSearch] No proxy endpoint configured — cannot search.');
        return null;
      }

      const q = buildSearchQuery(text);

      try {
        const resp = await fetch(`${endpoint}/search`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ q, num }),
          signal:  AbortSignal.timeout(8000)   // 8-second hard timeout
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Search HTTP ${resp.status}`);
        }

        const data = await resp.json();
        // Normalise — some backends return { results } others return array
        if (Array.isArray(data))        return { results: data,         query: q, source: 'web' };
        if (Array.isArray(data?.results)) return { results: data.results, query: data.query || q, source: data.source || 'web' };
        return null;

      } catch (e) {
        if (e.name === 'TimeoutError') {
          console.warn('[AppSearch] Search timed out after 8s');
        } else {
          console.warn('[AppSearch] Search failed:', e.message);
        }
        return null;
      }
    },

    /**
     * Full pipeline: decide → search → format context block.
     * Called from app.js sendMessage().
     *
     * Returns:
     *   { contextBlock: string, searched: boolean, source: string|null }
     */
    async prepareContext(userText) {
      if (!this.needsSearch(userText)) {
        return { contextBlock: '', searched: false, source: null };
      }

      const data = await this.query(userText);

      if (!data?.results?.length) {
        return { contextBlock: '', searched: false, source: null };
      }

      return {
        contextBlock: formatResultsAsContext(data.results, data.query || userText),
        searched:     true,
        source:       data.source || 'web'
      };
    },

    /**
     * Force-search regardless of heuristics (called if user explicitly
     * asks to search or search toggle is on and user typed a plain query).
     */
    async forceSearch(userText, num = MAX_RESULTS) {
      const data = await this.query(userText, num);
      if (!data?.results?.length) {
        return { contextBlock: '', searched: false, source: null };
      }
      return {
        contextBlock: formatResultsAsContext(data.results, data.query || userText),
        searched:     true,
        source:       data.source || 'web'
      };
    },

    // Expose for testing / debugging in console
    _shouldSearch:  shouldSearch,
    _buildQuery:    buildSearchQuery,
    _formatResults: formatResultsAsContext,
  };

  window.AppSearch = Search;

})();
