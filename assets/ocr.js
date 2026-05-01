// assets/ocr.js — vision & OCR payload builder
// Loaded before app.js. Exposes window.AppOCR

(function () {

  // ── Model registries ───────────────────────────────────────────────────
  // Standard OpenRouter vision format: image_url content parts
  const VISION_MODELS = new Set([
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-4b-it:free',
    'google/gemma-3n-e4b-it:free',
    'google/gemma-3n-e2b-it:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'nvidia/llama-nemotron-embed-vl-1b-v2:free',
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'meta-llama/llama-3.2-90b-vision-instruct:free',
    'qwen/qwen2.5-vl-7b-instruct:free',
    'qwen/qwen2.5-vl-32b-instruct:free',
    'tencent/hy3-preview:free',
  ]);

  // Specialised document/OCR models
  const OCR_MODELS = new Set([
    'baidu/qianfan-ocr-fast:free',
  ]);

  // Models that need base64-only (no full data-URL prefix allowed)
  const B64_ONLY_MODELS = new Set([
    'baidu/qianfan-ocr-fast:free',
  ]);

  // Maximum image dimension to resize to before sending (saves tokens)
  const MAX_DIM = 1600;

  // ── Image utilities ────────────────────────────────────────────────────

  // Parse "data:image/png;base64,..." → { mimeType, b64 }
  function parseDataUrl(dataUrl) {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/s);
    if (!m) return { mimeType: 'image/png', b64: dataUrl };
    return { mimeType: m[1], b64: m[2] };
  }

  // Resize an image dataUrl so its longest edge ≤ MAX_DIM.
  // Returns a Promise<string> (dataUrl), passes through if already small enough.
  function resizeIfNeeded(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (w <= MAX_DIM && h <= MAX_DIM) { resolve(dataUrl); return; }
        const scale  = MAX_DIM / Math.max(w, h);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(dataUrl); // pass through on error
      img.src = dataUrl;
    });
  }

  // Build a single OpenRouter image_url content part
  function buildImagePart(dataUrl, modelId) {
    if (B64_ONLY_MODELS.has(modelId)) {
      // Some models want { type, media_type, data } format
      const { mimeType, b64 } = parseDataUrl(dataUrl);
      return {
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${b64}`, detail: 'high' }
      };
    }
    return {
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'auto' }
    };
  }

  // ── OCR system prompt ──────────────────────────────────────────────────
  const OCR_SYSTEM_ADDENDUM =
    '\nYou are a precise OCR engine. Extract ALL text from the provided image(s) ' +
    'exactly as it appears, preserving layout, line breaks, tables, and formatting. ' +
    'Do not summarise or paraphrase. Output plain text unless the source is clearly ' +
    'a table, in which case use Markdown table format.';

  // ── Public API ─────────────────────────────────────────────────────────

  const OCR = {

    isVisionModel(modelId) { return VISION_MODELS.has(modelId); },
    isOcrModel(modelId)    { return OCR_MODELS.has(modelId); },
    isMultimodal(modelId)  { return VISION_MODELS.has(modelId) || OCR_MODELS.has(modelId); },

    /**
     * Standard vision: injects image_url parts into the last user message.
     * Returns a new messages array (original is not mutated).
     */
    async buildVisionMessages(apiMessages, imageFiles, modelId) {
      if (!imageFiles.length) return apiMessages;

      // Resize images in parallel
      const resizedUrls = await Promise.all(
        imageFiles.map(f => resizeIfNeeded(f.dataUrl))
      );

      const msgs = apiMessages.map(m => ({ ...m }));

      // Find last user message
      let lastIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') { lastIdx = i; break; }
      }
      if (lastIdx === -1) return msgs;

      const lastUser   = msgs[lastIdx];
      const textContent = typeof lastUser.content === 'string'
        ? lastUser.content
        : (lastUser.content?.find?.(p => p.type === 'text')?.text || '');

      const parts = [
        ...resizedUrls.map(url => buildImagePart(url, modelId)),
        {
          type: 'text',
          text: textContent ||
            'Please describe and analyse the attached image(s) in detail.'
        }
      ];

      msgs[lastIdx] = { role: 'user', content: parts };
      return msgs;
    },

    /**
     * OCR-specialised build: stronger system prompt + high-detail image parts.
     * Used for baidu/qianfan-ocr-fast and any future dedicated OCR models.
     */
    async buildOcrMessages(apiMessages, imageFiles, userText, modelId) {
      if (!imageFiles.length) return apiMessages;

      const resizedUrls = await Promise.all(
        imageFiles.map(f => resizeIfNeeded(f.dataUrl))
      );

      const msgs = [];

      // Patch or inject system message with OCR addendum
      const existingSystem = apiMessages.find(m => m.role === 'system');
      msgs.push({
        role:    'system',
        content: (existingSystem?.content || '') + OCR_SYSTEM_ADDENDUM
      });

      // All prior non-system messages except the last user turn
      const nonSystem = apiMessages.filter(m => m.role !== 'system');
      nonSystem.slice(0, -1).forEach(m => msgs.push({ ...m }));

      // Final user message: images + instruction
      const instruction = (userText || '').trim() ||
        'Extract all text from this image. Preserve all formatting, tables, and structure exactly.';

      msgs.push({
        role: 'user',
        content: [
          ...resizedUrls.map(url => buildImagePart(url, modelId)),
          { type: 'text', text: instruction }
        ]
      });

      return msgs;
    },

    /**
     * Main entry point — called from app.js sendMessage().
     *
     * Decides which builder to use based on modelId.
     * Returns: { messages: Array, hasImages: boolean }
     */
    async preparePayload(modelId, apiMessages, allFiles, userText) {
      const imageFiles = allFiles.filter(f => f.type === 'image');

      if (!imageFiles.length) {
        return { messages: apiMessages, hasImages: false };
      }

      if (this.isOcrModel(modelId)) {
        return {
          messages:  await this.buildOcrMessages(apiMessages, imageFiles, userText, modelId),
          hasImages: true
        };
      }

      if (this.isVisionModel(modelId)) {
        return {
          messages:  await this.buildVisionMessages(apiMessages, imageFiles, modelId),
          hasImages: true
        };
      }

      // Text-only model: keep the existing "[User attached image(s): ...]" text fallback
      return { messages: apiMessages, hasImages: false };
    },

    // ── Convenience helpers ──────────────────────────────────────────────

    /** Returns a human-readable label shown in the UI for the image capability */
    capabilityLabel(modelId) {
      if (OCR_MODELS.has(modelId))    return 'OCR';
      if (VISION_MODELS.has(modelId)) return 'Vision';
      return null;
    },

    /** List all vision-capable model IDs (for UI hint / validation) */
    allVisionModels() {
      return [...VISION_MODELS, ...OCR_MODELS];
    }
  };

  window.AppOCR = OCR;

})();
