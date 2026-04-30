(function () {

  // ── Config ────────────────────────────────────────────────────────────────
  const SEARCH_ENDPOINT = window.PROXY_URL || '';

  // How many results to pull and inject
  const MAX_RESULTS = 5;

  // Minimum query length before attempting a search
  const MIN_QUERY_LEN = 12;

  // Patterns that strongly suggest real-time / factual lookup is needed
  const SEARCH_TRIGGERS = [
    /\b(today|tonight|yesterday|this week|this month|this year|right now|currently|latest|recent|now|2024|2025|2026)\b/i,
    /\b(news|weather|price|stock|score|result|winner|election|release|update|version|launch)\b/i,
    /\b(who is|what is|when did|where is|how much|is it|will it|has .+? happened)\b/i,
    /\b(search|look up|find out|google|check|browse|internet|web|online)\b/i,
    /\?([\s\S]{0,200})$/,   // ends with a question
  ];

  // Topics that never benefit from a search (code, creative, math, etc.)
  const NO_SEARCH_PATTERNS = [
    /^(write|create|generate|make|build|code|fix|debug|explain|translate|summarise|summarize|list|give me|show me|help me write)/i,
    /^(def |function |class |import |SELECT |INSERT |UPDATE |<html|{)/,
    /\b(regex|algorithm|function|script|code|formula|equation|calculate|convert)\b/i,
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────

  function shouldSearch(text) {
    if (!text || text.length < MIN_QUERY_LEN) return false;
    if (NO_SEARCH_PATTERNS.some(p => p.test(text))) return false;
    return SEARCH_TRIGGERS.some(p => p.test(text));
  }

  function formatResultsAsContext(results, query) {
    if (!results?.length) return '';

    const lines = [
      `## Web Search Results`,
      `Query: "${query}"`,
      `Retrieved: ${new Date().toUTCString()}`,
      ``,
    ];

    results.forEach((r, i) => {
      lines.push(`**[${i + 1}] ${r.title}**`);
      if (r.snippet) lines.push(r.snippet.trim());
      if (r.url) lines.push(`Source: ${r.url}`);
      lines.push('');
    });

    lines.push(
      `---`,
      `Use the above search results to inform your answer. `,
      `Cite sources where relevant. If results are insufficient, say so.`
    );

    return lines.join('\n');
  }

  // ── Main API ──────────────────────────────────────────────────────────────

  const Search = {

    /**
     * Returns true if the query looks like it needs a web search.
     */
    needsSearch(text) {
      return shouldSearch(text);
    },

    /**
     * Performs the search via the Cloudflare Worker /search endpoint.
     * Returns { results, source, query } or null on failure.
     */
    async query(text, num = MAX_RESULTS) {
      if (!SEARCH_ENDPOINT) {
        console.warn('[Search] No PROXY_URL — cannot search');
        return null;
      }

      try {
        const resp = await fetch(`${SEARCH_ENDPOINT}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, num })
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Search failed: ${resp.status}`);
        }

        return await resp.json();
      } catch (e) {
        console.warn('[Search] Failed:', e.message);
        return null;
      }
    },

    /**
     * Full pipeline: check if needed → query → format as context string.
     * Returns { contextBlock: string, searched: boolean, source: string }
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
        searched: true,
        source: data.source || 'web'
      };
    }
  };

  window.AppSearch = Search;

})();
