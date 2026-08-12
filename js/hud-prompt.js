/**
 * Bottom HUD prompt: unfinished dialogue always outranks nearby interaction hints.
 *
 * Priority:
 *  1. Dialogue module (active briefing) — owns the box until finished
 *  2. Nearby interactables (stalls, see outside / console) — only when free
 *
 * On mobile, nearby prompts are tappable (no E key).
 */
export class HudPrompt {
  /**
   * @param {HTMLElement} el
   * @param {{ touchMode?: boolean }} [opts]
   */
  constructor(el, opts = {}) {
    this.el = el;
    this.touchMode = !!opts.touchMode;
    /**
     * @type {{
     *   id: string,
     *   text?: string | null,
     *   clickable?: boolean,
     *   onActivate?: () => void,
     * } | null}
     */
    this._dialogue = null;
    /** @type {string | null} */
    this._nearby = null;
    /** @type {(() => void) | null} */
    this._nearbyActivate = null;
    this._renderedKey = "";

    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._dialogue?.clickable) {
        this._dialogue.onActivate?.();
        return;
      }
      if (this.touchMode && this._nearbyActivate && this._nearby) {
        this._nearbyActivate();
      }
    });
  }

  /**
   * Claim the box for unfinished dialogue.
   * Pass null when dialogue is done / not in range.
   * `text` may be null/empty to suppress nearby prompts without showing a label
   * (e.g. while a briefing is already typing).
   */
  setDialogue(offer) {
    this._dialogue = offer || null;
  }

  clearDialogue(id) {
    if (!this._dialogue) return;
    if (!id || this._dialogue.id === id) this._dialogue = null;
  }

  /**
   * Nearby interaction fallback — ignored while dialogue claims the module.
   * @param {string | null} text
   * @param {(() => void) | null} [onActivate] mobile tap handler
   */
  setNearby(text, onActivate = null) {
    this._nearby = text || null;
    this._nearbyActivate = onActivate || null;
  }

  get hasDialogue() {
    return !!this._dialogue;
  }

  get dialogueClickable() {
    return !!(this._dialogue && this._dialogue.clickable);
  }

  activateDialogue() {
    if (!this._dialogue?.clickable) return false;
    this._dialogue.onActivate?.();
    return true;
  }

  /** Apply current priority to the DOM. */
  refresh() {
    let text = null;
    let clickable = false;
    let dialogueOwns = false;

    if (this._dialogue) {
      dialogueOwns = true;
      text = this._dialogue.text || null;
      clickable = !!this._dialogue.clickable && !!text;
    } else if (this._nearby) {
      text = this._nearby;
      clickable = this.touchMode && !!this._nearbyActivate;
    }

    const key = `${dialogueOwns ? "d" : "n"}|${text || ""}|${clickable ? 1 : 0}`;
    if (key === this._renderedKey) return;
    this._renderedKey = key;

    if (!text) {
      this.el.textContent = "";
      this.el.classList.remove("clickable");
      this.el.classList.add("hidden");
      return;
    }

    this.el.textContent = text;
    this.el.classList.toggle("clickable", clickable);
    this.el.classList.remove("hidden");
  }
}
