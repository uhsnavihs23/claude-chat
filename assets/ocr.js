(function () {

  // Models that accept image_url content parts in the standard OpenRouter vision format
  const VISION_MODELS = new Set([
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-4b-it:free',
    'google/gemma-3n-e4b-it:free',
    'google/gemma-3n-e2b-it:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'tencent/hy3-preview:free',
  ]);

  const OCR_MODELS = new Set([
    'baidu/qianfan-ocr-fast:free',
  ]);

  // ── helpers ──────────────────────────────────────────────────────────────

  // Strips "data:image/png;base64," prefix and returns { mimeType, b64 }
  function parseDataUrl(dataUrl) {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/s);
    if (!m) return { mimeType: 'image/png', b64: dataUrl };
    return { mimeType: m[1], b64: m[2] };
  }

  // Builds a single OpenRouter vision content part from a pending image file
  function buildImagePart(imgFile) {
    const { mimeType } = parseDataUrl(imgFile.dataUrl);
    return {
      type: 'image_url',
      image_url: {
        url: imgFile.dataUrl,   // OpenRouter accepts full data-URLs
        detail: 'auto'
      }
    };
  }

  // ── public API ────────────────────────────────────────────────────────────

  const OCR = {

    isVisionModel(modelId) {
      return VISION_MODELS.has(modelId);
    },

    isOcrModel(modelId) {
      return OCR_MODELS.has(modelId);
    },

    isMultimodal(modelId) {
      return this.isVisionModel(modelId) || this.isOcrModel(modelId);
    },

    /**
     * Rebuilds the messages array so the LAST user message has image content
     * parts injected alongside any text — standard OpenRouter vision format.
     *
     * @param {Array}  apiMessages  - current messages array (role/content objects)
     * @param {Array}  imageFiles   - pending image files with { dataUrl, name, mime }
     * @returns {Array} patched messages array
     */
    buildVisionMessages(apiMessages, imageFiles) {
      if (!imageFiles.length) return apiMessages;

      // Deep-clone to avoid mutating original
      const msgs = apiMessages.map(m => ({ ...m }));

      // Find the last user message
      let lastUserIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') { lastUserIdx = i; break; }
      }

      if (lastUserIdx === -1) return msgs;

      const lastUser = msgs[lastUserIdx];
      const textContent = typeof lastUser.content === 'string'
        ? lastUser.content
        : (lastUser.content?.find?.(p => p.type === 'text')?.text || '');

      // Build multi-part content array: images first, then text
      const parts = [
        ...imageFiles.map(f => buildImagePart(f)),
        { type: 'text', text: textContent || 'Please describe and analyse the attached image(s).' }
      ];

      msgs[lastUserIdx] = { role: 'user', content: parts };
      return msgs;
    },

    /**
     * For Baidu Qianfan-OCR-Fast: builds messages with image_url content parts.
     * The model expects the same OpenRouter multipart format but is optimised
     * for document / dense-text OCR, so we use a strong system prompt.
     *
     * @param {Array}  apiMessages
     * @param {Array}  imageFiles
     * @param {string} userText    - original user question/instruction
     * @returns {Array} patched messages array
     */
    buildOcrMessages(apiMessages, imageFiles, userText) {
      if (!imageFiles.length) return apiMessages;

      const msgs = [];

      // Inject an OCR-optimised system message at the top
      const existingSystem = apiMessages.find(m => m.role === 'system');
      if (existingSystem) {
        msgs.push({
          role: 'system',
          content: existingSystem.content +
            '\nYou are a precise OCR engine. Extract ALL text from the provided image(s) exactly as it appears, preserving layout, line breaks, tables, and formatting. Do not summarise or paraphrase.'
        });
      } else {
        msgs.push({
          role: 'system',
          content: 'You are a precise OCR engine. Extract ALL text from the provided image(s) exactly as it appears, preserving layout, line breaks, tables, and formatting. Do not summarise or paraphrase.'
        });
      }

      // Add all prior non-system messages unchanged
      apiMessages
        .filter(m => m.role !== 'system')
        .slice(0, -1)  // all except the last user message
        .forEach(m => msgs.push({ ...m }));

      // Build the final user message with images + instruction
      const instruction = userText?.trim()
        || 'Extract all text from this image. Preserve all formatting, tables, and structure exactly.';

      const parts = [
        ...imageFiles.map(f => buildImagePart(f)),
        { type: 'text', text: instruction }
      ];

      msgs.push({ role: 'user', content: parts });
      return msgs;
    },

    /**
     * Main entry point called from sendMessage().
     * Decides which payload builder to use based on the selected model.
     *
     * @param {string} modelId
     * @param {Array}  apiMessages
     * @param {Array}  allFiles       - all pending files (image + table + text)
     * @param {string} userText
     * @returns {{ messages: Array, hasImages: boolean }}
     */
    preparePayload(modelId, apiMessages, allFiles, userText) {
      const imageFiles = allFiles.filter(f => f.type === 'image');

      if (!imageFiles.length) {
        return { messages: apiMessages, hasImages: false };
      }

      if (this.isOcrModel(modelId)) {
        return {
          messages: this.buildOcrMessages(apiMessages, imageFiles, userText),
          hasImages: true
        };
      }

      if (this.isVisionModel(modelId)) {
        return {
          messages: this.buildVisionMessages(apiMessages, imageFiles),
          hasImages: true
        };
      }

      // Text-only model: keep the current [User attached image(s): ...] text fallback
      return { messages: apiMessages, hasImages: false };
    }
  };

  window.AppOCR = OCR;

})();
