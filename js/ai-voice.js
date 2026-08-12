/**
 * Simple script readout via Web Speech API.
 * Queued line-by-line; exposes viz (0..1) pulsed on real word boundaries
 * (SpeechSynthesis has no Web Audio volume — boundaries are the simple sync).
 */

function normalizeLine(text) {
  return String(text || "")
    .replace(/·/g, ",")
    .replace(/—/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFemaleVoice() {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : voices;
  return (
    pool.find((v) =>
      /female|zira|samantha|victoria|aria|jenny|sara|moira|tessa/i.test(v.name)
    ) || null
  );
}

export class AiVoice {
  constructor() {
    /** @type {string[]} */
    this._queue = [];
    this._busy = false;
    this._gen = 0;
    this.pitch = 2;
    // Mobile OS voices already sound higher / faster — keep pitch normal on phones.
    const touch =
      typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    this.pitch = touch ? 1 : 2;
    // Same utterance.rate sounds much faster on mobile OS voices.
    this.rate = touch ? 1.05 : 1.85;
    /** Mouth / wire viz level 0..1 — spikes per spoken word */
    this.viz = 0;
    this._boundaryOk = false;
    /** @type {string[]} */
    this._fbWords = [];
    this._fbIdx = 0;
    this._fbNext = 0;
  }

  async ensureCtx() {
    return null;
  }

  get speaking() {
    if (this._busy || this._queue.length > 0) return true;
    try {
      if (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking) return true;
    } catch (_) {}
    return false;
  }

  /**
   * Call once per frame: decays viz; word-timer fallback if browser
   * never fires onboundary (some voices / Safari).
   * @param {number} dt
   * @returns {number} 0..1
   */
  tickViz(dt) {
    this.viz = Math.max(0, this.viz - dt * 5.8);
    if (this._busy && !this._boundaryOk && this._fbWords.length) {
      const now = performance.now();
      while (this._fbIdx < this._fbWords.length && now >= this._fbNext) {
        this.viz = 1;
        const w = this._fbWords[this._fbIdx] || "";
        this._fbIdx += 1;
        const sec = Math.max(0.1, (0.16 + w.length * 0.032) / this.rate);
        this._fbNext = now + sec * 1000;
      }
    }
    return this.viz;
  }

  stop() {
    this._gen += 1;
    this._queue.length = 0;
    this._busy = false;
    this.viz = 0;
    this._boundaryOk = false;
    this._fbWords = [];
    try {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    } catch (_) {}
  }

  async prefetch() {}

  async loadSentence() {
    return null;
  }

  speak(text) {
    const key = normalizeLine(text);
    if (!key) return;
    this._queue.push(key);
    void this._pump();
  }

  trySpeak(text) {
    if (this.speaking) return false;
    this.speak(text);
    return true;
  }

  async _pump() {
    if (this._busy) return;
    this._busy = true;
    const gen = this._gen;
    while (this._queue.length && gen === this._gen) {
      const key = this._queue.shift();
      await this._speakOne(key, gen);
    }
    if (gen === this._gen) {
      this._busy = false;
      this._fbWords = [];
    }
  }

  _speakOne(text, gen) {
    if (typeof speechSynthesis === "undefined" || gen !== this._gen) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = this.pitch;
        u.rate = this.rate;
        const voice = pickFemaleVoice();
        if (voice) u.voice = voice;

        this._boundaryOk = false;
        this._fbWords = text.split(/\s+/).filter(Boolean);
        this._fbIdx = 0;
        this._fbNext = performance.now() + 60 / this.rate;

        u.onstart = () => {
          if (gen !== this._gen) return;
          this.viz = 0.55;
          this._fbNext = performance.now() + 50 / this.rate;
        };
        // Real tempo when the engine reports word boundaries (Chrome etc.)
        u.onboundary = (e) => {
          if (gen !== this._gen) return;
          if (e.name === "word" || e.name === "sentence") {
            this._boundaryOk = true;
            this.viz = 1;
          }
        };
        u.onend = () => {
          if (gen === this._gen) this.viz = 0;
          resolve();
        };
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      } catch (_) {
        resolve();
      }
    });
  }
}

export const shipVoice = new AiVoice();

if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.addEventListener("voiceschanged", () => {
    /* voices load async on some browsers */
  });
}
