/**
 * Demo config for MMM-KeyBindings
 *
 * Usage: node --run demo
 *
 * Keyboard shortcuts for testing:
 *   ArrowLeft / ArrowRight / ArrowUp / ArrowDown  → shows alert (only in DEFAULT mode)
 *   Enter                                         → shows alert (only in DEFAULT mode)
 *   h                                             → changeMode to DEMO_MODE (arrows stop working)
 *   Return / Escape / Backspace                   → changeMode back to DEFAULT
 *
 * evdev is disabled so no Bluetooth device is required.
 */

const config = {
  address: "0.0.0.0",
  ipWhitelist: [],
  logLevel: ["INFO", "LOG", "WARN", "ERROR"],
  modules: [
    {
      module: "clock",
      position: "top_left"
    },
    {
      module: "alert",
      config: {}
    },
    {
      module: "compliments",
      position: "middle_center",
      config: {
        compliments: {
          anytime: ["MMM-KeyBindings Demo\n← → ↑ ↓ Enter — shows alert (DEFAULT mode only)\nh — switch to DEMO_MODE (arrows stop)\nReturn/Escape — back to DEFAULT"]
        }
      }
    },
    {
      module: "MMM-KeyBindings",
      config: {
        enableKeyboard: true,
        evdev: {enabled: false},
        handleKeys: ["h"],
        actions: [
          {
            key: "ArrowLeft",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "SHOW_ALERT",
            payload: {type: "notification", title: "MMM-KeyBindings", message: "← ArrowLeft pressed", timer: 2000}
          },
          {
            key: "ArrowRight",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "SHOW_ALERT",
            payload: {type: "notification", title: "MMM-KeyBindings", message: "→ ArrowRight pressed", timer: 2000}
          },
          {
            key: "ArrowUp",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "SHOW_ALERT",
            payload: {type: "notification", title: "MMM-KeyBindings", message: "↑ ArrowUp pressed", timer: 2000}
          },
          {
            key: "ArrowDown",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "SHOW_ALERT",
            payload: {type: "notification", title: "MMM-KeyBindings", message: "↓ ArrowDown pressed", timer: 2000}
          },
          {
            key: "Enter",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "SHOW_ALERT",
            payload: {type: "notification", title: "MMM-KeyBindings", message: "Enter pressed", timer: 2000}
          },
          {
            key: "h",
            changeMode: "DEMO_MODE"
          },
          {
            key: "Return",
            changeMode: "DEFAULT"
          }
        ]
      }
    }
  ]
};

/** ************* DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = config;
}
