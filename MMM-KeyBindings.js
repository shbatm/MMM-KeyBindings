/* global Module, window, Mousetrap, console */

/* Magic Mirror
 * Module: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */
 "use strict";


Module.register("MMM-KeyBindings", {
    defaults: {
        enabledKeyStates: ["KEY_PRESSED", "KEY_LONGPRESSED"], // Other options are 'KEY_UP', 'KEY_DOWN', 
                                                              // 'KEY_HOLD' but evdev.raw_mode must be true to receive
        handleKeys: [], // List of additional keys to handle in this module; blank == standard set
        disableKeys: [], // list of keys to ignore from the default set.
        enableNotifyServer: true,
        enableRelayServer: false,
        enableMousetrap: false,
        evdev: {        enabled: true,
                        alias: "",
                        bluetooth: "",
                        eventPath:'', 
                        disableGrab: false, 
                        longPressDuration: 0.7, 
                        rawMode: false
                },
        evdevKeymap: {  Home: "KEY_HOMEPAGE", 
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
        specialKeys: {  screenPowerOn: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_PRESSED" },
                        screenPowerOff: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_LONGPRESSED" },
                        screenPowerToggle: { KeyName:"", KeyState:"" },
                        osdToggle: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_PRESSED" },
                        extInterrupt1: { KeyName: "", KeyState: "" },
                        extInterrupt2: { KeyName: "", KeyState: "" },
                        extInterrupt3: { KeyName: "", KeyState: "" },
                     }, 
        extInterruptModes: [],

    },

    defaultMouseTrapKeys: ['home','enter','left','right','up','down','return','playpause','nexttrack','previoustrack'],

    defaultMouseTrapKeyCodes: { 179:'playpause', 178:'nexttrack', 177:'previoustrack'},

    // Allow for control on muliple instances
    instance: (["127.0.0.1","localhost"].indexOf(window.location.hostname) > -1) ? "SERVER" : "LOCAL",

    requiresVersion: "2.1.0", // Required version of MagicMirror

    start: function() {
        console.log(this.name + " has started...");

        this.sendSocketNotification("MMM-KeyBindings-SOCKET_START", this.name);

        if (this.config.enableNotifyServer) {
            this.sendSocketNotification("ENABLE_RESTNOTIFYSERVER", this.name);
            if (this.config.evdev.enabled) {
                this.sendSocketNotification("ENABLE_PYTHONDAEMON", this.config.evdev);
            }
        }

        this.currentKeyPressMode = "DEFAULT";

        // Generate a reverse key map
        this.reverseKeyMap = {};
        for (var eKey in this.config.evdevKeymap) {
            if (this.config.evdevKeymap.hasOwnProperty(eKey)) {
                this.reverseKeyMap[this.config.evdevKeymap[eKey]] = eKey;
            }
        }

        // Nothing else to do...
    },

    getScripts: function () {
        return ['mousetrap.min.js', 'mousetrap-global-bind.min.js'];
    },

    setupMousetrap: function() {
        var self = this;
        var keys = this.defaultMouseTrapKeys;
        var keyCodes = this.defaultMouseTrapKeyCodes;

        Mousetrap.addKeycodes(keyCodes);

        // Add extra keys (must be in Mousetrap form)
        // TODO: Add ability to add extra keycodes as well
        keys = keys.concat(this.config.handleKeys);

        // Remove Disabled Keys
        for (var i = this.config.disableKeys.length - 1; i >= 0; i--) {
            var j = keys.indexOf(this.config.disableKeys[i]);
            if (j > -1) {
                keys.splice(j, 1);
            }
        }

        // console.log(keys);

        Mousetrap.bindGlobal(keys, (e) => {
            // Prevent the default action from occuring
            if (e.preventDefault) {
                e.preventDefault();
            } else {
                // internet explorer
                e.returnValue = false;
            }

            var payload = {};
            payload.KeyName = e.key;
            if (this.config.evdev.rawMode) {
                payload.KeyState = e.type;
            } else {
                payload.KeyState = "KEY_PRESSED";
            }
            payload.CurrentMode = self.currentKeyPressMode;
            payload.Sender = self.instance;
            payload.Protocol = "mousetrap";
            self.sendNotification("KEYPRESS", payload);
            //console.log(payload);
        });
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
                payload.KeyName === this.config.specialKeys[sKey].KeyName && 
                ("KeyState" in this.config.specialKeys[sKey]) && 
                payload.KeyState === this.config.specialKeys[sKey].KeyState) {
                payload.SpecialKeys.push(sKey);
            }
        }
        return payload;
    },

    handleLocalSpecialKeys: function(payload) {
        var handled = false;
        // console.log("Current Payload: " + JSON.stringify(payload, null, 4));
        switch (payload.SpecialKeys[0]) {
            case "osdToggle":
                if (this.currentKeyPressMode === "DEFAULT") {
                    console.log("Showing OSD"); // !TODO: Actually have an OSD menu
                    this.currentKeyPressMode = this.name + "_OSD";
                } else if (this.currentKeyPressMode === this.name + "_OSD") {
                    console.log("Hiding OSD"); // !TODO: Actually have an OSD menu
                    this.currentKeyPressMode = "DEFAULT";
                }
                handled = true;
                break;
            case "extInterrupt1":
                if (this.config.extInterruptModes.length > 0) {
                    this.currentKeyPressMode = this.config.extInterruptModes[0];
                    handled = true;
                }
                break;
            case "extInterrupt2":
                if (this.config.extInterruptModes.length > 1) {
                    this.currentKeyPressMode = this.config.extInterruptModes[1];
                    handled = true;
                }
                break;
            case "extInterrupt3":
                if (this.config.extInterruptModes.length > 2) {
                    this.currentKeyPressMode = this.config.extInterruptModes[2];
                    handled = true;
                }
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
        var nodeHelperKeys = ["screenPowerOn", "screenPowerOff", "screenPowerToggle"];
        if (!("SpecialKeys" in payload)) {
            payload = this.addSpecialKeys(payload);
        }
        if (payload.SpecialKeys.length > 0) {
            if (nodeHelperKeys.indexOf(payload.SpecialKeys[0]) > -1) {
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
        payload.Protocol = "evdev";

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
        } else if (this.config.enableRelayServer) {
            this.sendNotification(notification, payload);
        }
    },

    notificationReceived: function (notification, payload, sender) {
        if (notification === "DOM_OBJECTS_CREATED") {
            if (this.config.enableMousetrap && !(this.config.enableNotifyServer && 
                    this.instance === "SERVER")) {
                console.log("Setting up Mousetrap keybindings.");
                this.setupMousetrap();
            }
        }
        if (notification === "ALL_MODULES_STARTED") {
            // do nothing
        }
        if (notification === "KEYPRESS_MODE_CHANGED") {
            this.currentKeyPressMode = payload;
        }
    },

});
