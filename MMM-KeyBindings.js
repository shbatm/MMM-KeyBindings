/* global Module */

/* Magic Mirror
 * Module: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

Module.register("MMM-KeyBindings", {
    defaults: {
        enabledKeyStates: ["KEY_PRESSED", "KEY_LONGPRESSED"], // Other options are 'KEY_UP', 'KEY_DOWN', 
                                                              // 'KEY_HOLD' but evdev.raw_mode must be true to receive
        handleKeys: [], // List of keys to handle in this module; blank == any
        enableNotifyServer: true,
        evdev: {        enabled: true, 
                        event_path:'', 
                        disable_grab: false, 
                        long_press_duration: 0.7, 
                        raw_mode: false
                },
        evdev_keymap: { Home: "KEY_HOMEPAGE", 
                        Enter: "KEY_KPENTER", 
                        ArrowLeft: "KEY_LEFT", 
                        ArrowRight: "KEY_RIGHT", 
                        ArrowUp: "KEY_UP", 
                        ArrowDown: "KEY_DOWN",
                        Menu: "KEY_MENU", 
                        MediaPlayPause: "KEY_PLAYPAUSE", 
                        MediaNextTrack: "KEY_FASTFORWARD", 
                        MediaPreviousTrack: "KEY_REWIND",
                        Return: "KEY_BACK"},
        specialKeys: {  screen_power_on: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_PRESSED" },
                        screen_power_off: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_LONGPRESSED" },
                        screen_power_toggle: { KeyName:"", KeyState:"" },
                        osd_toggle: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_PRESSED" },
                     }, 

    },

    requiresVersion: "2.1.0", // Required version of MagicMirror

    start: function() {
        var self = this;
        console.log(this.name + " has started...");

        this.sendSocketNotification("MMM-KeyBindings-SOCKET_START", this.name);

        if (this.config.enableNotifyServer) {
            this.sendSocketNotification("ENABLE_RESTNOTIFYSERVER", this.name);
            if (this.config.evdev.enabled) {
                console.log("startying python with evdev:" + this.config.evdev);
                this.sendSocketNotification("ENABLE_PYTHONDAEMON", this.config.evdev);
            }
        }

        this.currentKeyPressMode = "DEFAULT";

        // Generate a reverse key map
        this.reverseKeyMap = {};
        for (var eKey in this.config.evdev_keymap) {
            if (this.config.evdev_keymap.hasOwnProperty(eKey)) {
                this.reverseKeyMap[this.config.evdev_keymap[eKey]] = eKey;
            }
        }

        // Nothing else to do...
    },

    addSpecialKeys: function(payload) {
        // Special Keys are keys processed by this module first above all other modes
        // If there is nothing to do, they are passed on to the other modules.
        // If a single key & press is assigned to muliple specialKeys, we will
        // try them in order of config in node_helper as a queue. For example: if the "MENU" key
        // longpressed is assigned to (a) turn on the screen and if the screen is on 
        // (b) open a On Screen Menu then we will try to turn on the screen and if its
        // on then we'll start the OSM. 
        payload.SpecialKeys = [];
        for (var sKey in this.config.specialKeys) {
            // console.log("Testing specialKeys", sKey);
            if (("KeyName" in this.config.specialKeys[sKey]) && 
                payload.KeyName == this.config.specialKeys[sKey].KeyName && 
                ("KeyState" in this.config.specialKeys[sKey]) && 
                payload.KeyState == this.config.specialKeys[sKey].KeyState) {
                payload.SpecialKeys.push(sKey);
            }
        }
        return payload;
    },

    handleLocalSpecialKeys: function(payload) {
        var self = this;
        var handled = false;
        // console.log("Current Payload: " + JSON.stringify(payload, null, 4));
        switch (payload.SpecialKeys[0]) {
            case "osd_toggle":
                if (this.currentKeyPressMode === "DEFAULT") {
                    console.log("Showing OSD"); // !TODO: Actually have an OSD menu
                    this.currentKeyPressMode = this.name + "_OSD";
                } else if (this.currentKeyPressMode == this.name + "_OSD") {
                    console.log("Hiding OSD"); // !TODO: Actually have an OSD menu
                    this.currentKeyPressMode = "DEFAULT";
                }
                handled = true;
                break;
            default:
                handled = false;
        }

        if (!handled) {
            payload.SpecialKeys.splice(0,1);
            this.handleEvDevKeyPressEvents(payload);
        }
    },

    handleEvDevKeyPressEvents: function(payload) {
        // Either do something here or kick it to the node_helper for NodeJS functions
        // this variable stores all of the keys that require node_helper to do something
        // Special keys will boomerang until an action is taken or it gets passed to the
        // other modules.
        var node_helper_keys = ["screen_power_on", "screen_power_off", "screen_power_toggle"];
        if (!("SpecialKeys" in payload)) {
            payload = this.addSpecialKeys(payload);
        }
        if (payload.SpecialKeys.length > 0) {
            if (node_helper_keys.indexOf(payload.SpecialKeys[0]) > -1) {
                // console.log(payload.KeyName + " is a special key should be handled by node_helper...");
                this.sendSocketNotification("PROCESS_KEYPRESS", payload);
                return;
            } else {
                this.handleLocalSpecialKeys(payload);
                return;
            }
        }
        // No special keys assigned or no action was taken on a special key

        // Add the current mode to the payload
        payload.CurrentMode = this.currentKeyPressMode;

        // Add the sender to the payload (useful if you have multiple clients connected; 
        // the evdev keys only work on the main server)
        payload.Sender = "SERVER";

        // Standardize the name
        if (payload.KeyName in this.reverseKeyMap) {
            payload.KeyName = this.reverseKeyMap[payload.KeyName];
        }
        // Finally Broadcast Key and mode to all Modules
        // console.log("Broacasting to all modules: ", payload);
        this.sendNotification("KEYPRESS", payload);
    },

    // socketNotificationReceived from helper
    socketNotificationReceived: function (notification, payload) {
        // console.log("Working notification system. Notification:", notification, "payload: ", payload);
        if (notification === "KEYPRESS") {
            if (this.config.enabledKeyStates.indexOf(payload.KeyState) > -1) {
                this.handleEvDevKeyPressEvents(payload);
            }
        }
    },

    notificationReceived: function (notification, payload, sender) {
        if (notification === "DOM_OBJECTS_CREATED") {
            // do nothing
        }
        if (notification === "ALL_MODULES_STARTED") {
            // do nothing
        }
        if (notification === "KEYPRESS_MODE_CHANGED") {
            this.currentKeyPressMode = payload;
        }
    },

});
