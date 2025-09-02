/* global Mousetrap */

const global = this;

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
    global.location &&
    [
      "localhost",
      "127.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
      undefined,
      "0.0.0.0"
    ].indexOf(global.location.hostname) > -1
      ? "SERVER"
      : "LOCAL",

  requiresVersion: "2.3.0", // Required version of MagicMirror

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
      this.file("node_modules/mousetrap/mousetrap.min.js"),
      this.file("node_modules/mousetrap-global-bind/mousetrap-global-bind.min.js")
    ];
  },

  setupMousetrap () {
    const self = this;
    let keys = [
      "home",
      "enter",
      "left",
      "right",
      "up",
      "down",
      "return",
      "playpause",
      "nexttrack",
      "previoustrack",
      "Menu"
    ];
    const keyCodes = {
      179: "playpause",
      178: "nexttrack",
      177: "previoustrack",
      93: "Menu"
    };
    const keyMap = {ContextMenu: "Menu"};

    Mousetrap.addKeycodes(keyCodes);

    /*
     * Add extra keys (must be in Mousetrap form)
     * TODO: Add ability to add extra keycodes as well
     */
    keys = keys.concat(this.config.handleKeys);

    // Remove Disabled Keys
    for (let i = this.config.disableKeys.length - 1; i >= 0; i--) {
      const j = keys.indexOf(this.config.disableKeys[i]);
      if (j > -1) {
        keys.splice(j, 1);
      }
    }

    Log.debug(keys);

    Mousetrap.bindGlobal(keys, (e) => {
      // Prevent the default action from occuring
      if (e.preventDefault) {
        e.preventDefault();
      } else {
        // internet explorer
        e.returnValue = false;
      }

      const payload = {};
      payload.keyName = e.key;

      // Standardize the name
      if (payload.keyName in keyMap) {
        payload.keyName = keyMap[payload.keyName];
      }

      if (this.config.evdev.rawMode) {
        payload.keyState = e.type;
      } else {
        payload.keyState = "KEY_PRESSED";
      }
      payload.currentMode = self.currentKeyPressMode;
      payload.sender = self.instance;
      payload.instance = self.instance;
      payload.protocol = "mousetrap";
      self.sendNotification("KEYPRESS", payload);
      self.doAction(payload);
    });

    // Squash bad actors:
    Mousetrap.bind(
      ["home", "Menu"],
      (e) => {
        e.preventDefault();
        return false;
      },
      "keyup"
    );
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
      if (this.config.enabledKeyStates.indexOf(payload.keyState) > -1) {
        this.handleEvDevKeyPressEvents(payload);
      }
    }
  },

  notificationReceived (notification, payload) {
    if (notification === "DOM_OBJECTS_CREATED") {
      if (this.config.enableKeyboard) {
        Log.log("Setting up Mousetrap keybindings.");
        this.setupMousetrap();
      }
    }
    if (notification === "KEYPRESS_MODE_CHANGED") {
      this.currentKeyPressMode = payload || "DEFAULT";
    }
  },

  doAction (payload) {
    const action = this.config.actions.filter((k) => k.key === payload.keyName);
    if (action) {
      action.forEach((a) => {
        if (a.state && a.state !== payload.keyState) {
          return;
        }
        if (a.instance && a.instance !== payload.sender) {
          return;
        }
        if (a.mode && a.mode !== payload.currentMode) {
          return;
        }

        if ("changeMode" in a) {
          this.currentKeyPressMode = a.changeMode;
          this.sendNotification("KEYPRESS_MODE_CHANGED", a.changeMode);
        } else {
          this.sendNotification(a.notification, a.payload);
        }
      });
    }
  }
});
