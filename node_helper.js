/* Magic Mirror
 * Node Helper: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */
/* jshint node: true, esversion: 6*/

const NodeHelper = require("node_helper");
var evdev;
var udev;

module.exports = NodeHelper.create({

    start: function() {
        console.log("MMM-KeyBindings helper has started...");
        this.evdevMonitorCreated = false;
    },

    stop: function() {
        if (this.evdevMonitorCreated) {
            console.log("EVDEV: Closing monitor and reader");
            try {
                this.udevMonitor.close();
            } catch (e) {
                if (e.toString().indexOf("Cannot read property 'close' of undefined") === -1) {
                    console.error(e);
                }
            }
            try {
                this.evdevReader.close();
            } catch (e) {
                console.error(e);
            }
        }
    },

    waitForDevice: function() {
        this.udevMonitor = udev.monitor();
        this.udevMonitor.on('add', (device) => {
            if ("DEVLINKS" in device && device.DEVLINKS === this.evdevConfig.eventPath) {
                console.log("UDEV: Device connected.");
                this.udevMonitor.close();
                this.setupDevice();
            }
        });
    },

    setupDevice: function() {
        this.device = this.evdevReader.open(this.evdevConfig.eventPath);
        this.device.on("open", () => {
            console.log(`EVDEV: Connected to device: ${JSON.stringify(this.device.id)}`);
        });
        this.device.on("close", () => {
            console.debug(`EVDEV: Connection to device has been closed.`);
            this.waitForDevice();
        });
    },

    startEvdevMonitor: function() {
        evdev = require("evdev");
        udev = require("udev");

        this.evdevMonitorCreated = true;
        this.evdevReader = new evdev();
        this.pendingKeyPress = {};

        this.evdevReader.on("EV_KEY", (data) => {
            // console.log("key : ", data.code, data.value);
            if (data.value > 0) {
                this.pendingKeyPress.code = data.code;
                this.pendingKeyPress.value = data.value;
            } else {
                if ("code" in this.pendingKeyPress && this.pendingKeyPress.code === data.code) {
                    console.log(`${this.pendingKeyPress.code} ${(this.pendingKeyPress.value===2) ? "long " : ""}pressed.`);
                    this.sendSocketNotification("KEYPRESS", {
                        'keyName': data.code,
                        'keyState': (this.pendingKeyPress.value === 2) ? "KEY_LONGPRESSED" : "KEY_PRESSED"
                    });
                }
                this.pendingKeyPress = {};
            }
        }).on("error", (e) => {
            if (e.code === 'ENODEV' || e.code === 'ENOENT') {
                console.info("EVDEV: Device not connected, nothing at path " + e.path + ", waiting for device...");
                this.waitForDevice();
            } else {
                console.error("EVDEV: ", e);
            }
        });

        this.setupDevice();
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "ENABLE_EVDEV") {
            if (!this.evdevMonitorCreated) {
                this.evdevConfig = payload;
                this.startEvdevMonitor();
            }
        }
    }
});