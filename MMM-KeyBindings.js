/* global NativeKeyHandler */

const LOCAL_HOSTS = [
  "localhost",
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "0.0.0.0"
];

Module.register("MMM-KeyBindings", {
  defaults: {
    enabledKeyStates: ["KEY_PRESSED", "KEY_LONGPRESSED"],
    // Other options are 'KEY_UP', 'KEY_DOWN', 'KEY_HOLD' but evdev.raw_mode must be true to receive
    handleKeys: [], // List of additional keys to handle in this module; blank == standard set
    disableKeys: [], // list of keys to ignore from the default set.
    enableKeyboard: false,
    evdev: {
      enabled: true,
      eventPath: "/dev/input/btremote"
    },
    keyMap: {
      Home: "KEY_HOMEPAGE",
      Enter: "KEY_KPENTER",
      ArrowLeft: "KEY_LEFT",
      ArrowRight: "KEY_RIGHT",
      ArrowUp: "KEY_UP",
      ArrowDown: "KEY_DOWN",
      Menu: "KEY_MENU",
      MediaPlayPause: "KEY_PLAYPAUSE",
      MediaNextTrack: "KEY_FASTFORWARD",
      MediaPreviousTrack: "KEY_REWIND",
      Return: "KEY_BACK"
    },
    actions: [
      {
        key: "Home",
        state: "KEY_LONGPRESSED",
        instance: "SERVER",
        mode: "DEFAULT",
        notification: "REMOTE_ACTION",
        payload: {action: "MONITORTOGGLE"}
        /*
         * Can also be:
         * changeMode: "NEW_MODE"
         * instead of notification & payload
         */
      }
    ]
  },

  // Allow for control on multiple instances
  instance:
    typeof window !== "undefined" && LOCAL_HOSTS.includes(window.location.hostname)
      ? "SERVER"
      : "LOCAL",

  start () {
    Log.info(`${this.name} has started…`);

    // Allow Legacy Config Settings:
    if (this.config.evdevKeyMap) {
      this.config.keyMap = this.config.evdevKeyMap;
    }

    if (this.config.evdev.enabled) {
      this.sendSocketNotification("ENABLE_EVDEV", this.config.evdev);
    }

    this.currentKeyPressMode = "DEFAULT";

    // Generate a reverse key map
    this.reverseKeyMap = {};
    for (const eKey in this.config.keyMap) {
      if (Object.hasOwn(this.config.keyMap, eKey)) {
        this.reverseKeyMap[this.config.keyMap[eKey]] = eKey;
      }
    }
  },

  getScripts () {
    return [
      "keyHandler.js",
      "nativeKeyHandler.js"
    ];
  },

  setupKeyboardHandler () {
    const self = this;
    let keys = [
      "Home",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Return",
      "MediaPlayPause",
      "MediaNextTrack",
      "MediaPreviousTrack",
      "Menu"
    ];

    // Add extra keys from config
    keys = keys.concat(this.config.handleKeys);

    // Remove disabled keys
    keys = keys.filter((k) => !this.config.disableKeys.includes(k));

    Log.debug(`[MMM-KeyBindings] Keyboard handler listening for: ${keys.join(", ")}`);

    NativeKeyHandler.init(keys, (keyName) => {
      const payload = {
        keyName,
        keyState: "KEY_PRESSED",
        currentMode: self.currentKeyPressMode,
        sender: self.instance,
        instance: self.instance,
        protocol: "keyboard"
      };

      self.sendNotification("KEYPRESS", payload);
      self.doAction(payload);
    });
  },

  handleEvDevKeyPressEvents (payload) {
    // Add the current mode to the payload
    payload.currentMode = this.currentKeyPressMode;

    /*
     * Add the sender to the payload (useful if you have multiple clients connected;
     * the evdev keys only work on the main server)
     */
    payload.sender = "SERVER";
    payload.protocol = "evdev";
    payload.instance = this.instance;

    // Standardize the name
    if (payload.keyName in this.reverseKeyMap) {
      payload.keyName = this.reverseKeyMap[payload.keyName];
    }
    this.sendNotification("KEYPRESS", payload);
    this.doAction(payload);
  },

  // socketNotificationReceived from helper
  socketNotificationReceived (notification, payload) {
    // Log.log("Working notification system. Notification:", notification, "payload: ", payload);
    if (notification === "KEYPRESS") {
      if (this.config.enabledKeyStates.includes(payload.keyState)) {
        this.handleEvDevKeyPressEvents(payload);
      }
    }
  },

  notificationReceived (notification, payload) {
    if (notification === "DOM_OBJECTS_CREATED") {
      if (this.config.enableKeyboard) {
        Log.log("[MMM-KeyBindings] Setting up keyboard handler.");
        this.setupKeyboardHandler();
      }
    }
    if (notification === "KEYPRESS_MODE_CHANGED") {
      this.currentKeyPressMode = payload || "DEFAULT";
    }
  },

  doAction (payload) {
    const actions = this.config.actions || [];
    for (const a of actions) {
      const matchesKey = a.key === payload.keyName;
      const matchesState = !a.state || a.state === payload.keyState;
      const matchesInstance = !a.instance || a.instance === payload.sender;
      const matchesMode = !a.mode || a.mode === payload.currentMode;

      if (!matchesKey || !matchesState || !matchesInstance || !matchesMode) {
        continue; // eslint-disable-line no-continue -- early skip keeps nesting shallow
      }

      if ("changeMode" in a) {
        this.currentKeyPressMode = a.changeMode;
        this.sendNotification("KEYPRESS_MODE_CHANGED", a.changeMode);
      } else {
        this.sendNotification(a.notification, a.payload);
      }
    }
  }
});
