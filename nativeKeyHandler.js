/**
 * Native Keyboard Handler for MMM-KeyBindings
 */

/* exported NativeKeyHandler */
/* eslint-disable no-unused-vars */

const NativeKeyHandler = {
  /**
   * Map browser key names to standardized names
   */
  keyMap: {
    Home: "Home",
    Enter: "Enter",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    Backspace: "Return",
    Escape: "Return",
    ContextMenu: "Menu",
    // Media keys
    MediaPlayPause: "MediaPlayPause",
    MediaTrackNext: "MediaNextTrack",
    MediaTrackPrevious: "MediaPreviousTrack"
  },

  /**
   * Registered handlers
   */
  handlers: [],

  /**
   * Keys to handle
   */
  activeKeys: [],

  /**
   * Keys that should have default action prevented on keyup too
   */
  suppressOnKeyUp: ["Home", "Menu"],

  /**
   * Initialize the key handler
   * @param {Array} keys - Array of key names to listen for
   * @param {Function} callback - Callback function(keyName, event)
   */
  init (keys, callback) {
    this.activeKeys = keys;
    this.handlers.push(callback);

    // Use capture phase to intercept before other handlers
    document.addEventListener("keydown", (e) => this.handleKeyDown(e), true);
    document.addEventListener("keyup", (e) => this.handleKeyUp(e), true);
  },

  /**
   * Get standardized key name from event
   * @param {KeyboardEvent} e - The keyboard event
   * @returns {string|null} - Standardized key name or null
   */
  getKeyName (e) {
    // Try mapped key first
    if (e.key && this.keyMap[e.key]) {
      return this.keyMap[e.key];
    }

    // Return the key as-is if it's in our active keys
    if (e.key && this.activeKeys.includes(e.key)) {
      return e.key;
    }

    return null;
  },

  /**
   * Check if a key should be handled
   * @param {string} keyName - The key name to check
   * @returns {boolean}
   */
  shouldHandle (keyName) {
    if (!keyName) {
      return false;
    }
    // Check against active keys (case-insensitive for flexibility)
    return this.activeKeys.some((k) => k.toLowerCase() === keyName.toLowerCase());
  },

  /**
   * Handle keydown events
   * @param {KeyboardEvent} e - The keyboard event
   */
  handleKeyDown (e) {
    const {target} = e;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
      return; // don't steal focus from form fields
    }

    const keyName = this.getKeyName(e);

    if (this.shouldHandle(keyName)) {
      e.preventDefault();
      e.stopPropagation();

      // Call all registered handlers
      for (const handler of this.handlers) {
        handler(keyName, e);
      }
    }
  },

  /**
   * Handle keyup events (to suppress default actions)
   * @param {KeyboardEvent} e - The keyboard event
   */
  handleKeyUp (e) {
    const {target} = e;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
      return;
    }

    const keyName = this.getKeyName(e);

    if (keyName && this.suppressOnKeyUp.includes(keyName)) {
      e.preventDefault();
      e.stopPropagation();
    }
  },

  /**
   * Add additional keys to handle
   * @param {Array} keys - Array of key names to add
   */
  addKeys (keys) {
    for (const key of keys) {
      if (!this.activeKeys.includes(key)) {
        this.activeKeys.push(key);
      }
    }
  },

  /**
   * Remove keys from handling
   * @param {Array} keys - Array of key names to remove
   */
  removeKeys (keys) {
    this.activeKeys = this.activeKeys.filter((k) => !keys.includes(k));
  }
};
