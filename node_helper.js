/* Magic Mirror
 * Node Helper: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */
/* jshint node: true, esversion: 6*/

const NodeHelper = require("node_helper");
const url = require("url");
const exec = require("child_process").exec;
const evdev = require("evdev");
const udev = require("udev");
// const os = require("os");


module.exports = NodeHelper.create({

    start: function() {
        console.log("MMM-KeyBindings helper has started...");
        this.notifyServerCreated = false;
        this.evdevMonitorCreated = false;
    },

    stop: function() {
        if (this.evdevMonitorCreated) {
            console.log("EVDEV: Closing monitor and reader");
            try {
                this.udevMonitor.close();
            } catch (e) {}
            try {
                this.evdevReader.close();
            } catch (e) {}
        }
    },

    createNotifyServer: function() {
        var self = this;
        // Basic URL Interface to accept push notifications formatted like
        // http://localhost:8080/MMM-KeyBindings/notify?notification=TITLE&payload=JSONstringifiedSTRING
        this.expressApp.get("/" + this.name + "/notify", (req, res) => {
            var query = url.parse(req.url, true).query;
            var notification = query.notification;
            var payload;
            try {
                payload = JSON.parse(query.payload);
            } catch (e) {
                // Oh well, but whatever...
            }

            if (typeof payload === "undefined") {
                payload = [];
            }
            self.sendSocketNotification(notification, payload);
            // console.log("Sent socketNotification " + notification + " with payload:" + JSON.stringify(payload, null, 4));
            res.sendStatus(200);
        });

        console.log("Notify Server created at /" + this.name + "/notify");
        this.notifyServerCreated = true;
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
                        'KeyName': data.code,
                        'KeyState': (this.pendingKeyPress.value === 2) ? "KEY_LONGPRESSED" : "KEY_PRESSED"
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

    handleEvDevKeyPressEvents: function(payload) {
        var self = this;
        this.currentPayload = payload;
        var screenStatus;
        //console.log("Current Payload: " + JSON.stringify(payload, null, 4));
        switch (payload.SpecialKeys[0]) {
            case "screenPowerOn":
                screenStatus = exec("tvservice --status",
                    function(error, stdout, stderr) {
                        var handled = false;
                        if (stdout.indexOf("TV is off") !== -1) {
                            // Screen is OFF, turn it ON
                            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", function(error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                            handled = true;
                        }
                        self.checkForExecError(error, stdout, stderr);
                        self.handleEvDevKeyPressEventsCallback(handled);
                    });
                break;
            case "screenPowerOff":
                screenStatus = exec("tvservice --status",
                    function(error, stdout, stderr) {
                        var handled = false;
                        if (stdout.indexOf("HDMI") !== -1) {
                            // Screen is ON, turn it OFF
                            exec("tvservice -o", function(error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                            handled = true;
                        }
                        self.checkForExecError(error, stdout, stderr);
                        self.handleEvDevKeyPressEventsCallback(handled);
                    });
                break;
            case "screenPowerToggle":
                screenStatus = exec("tvservice --status",
                    function(error, stdout, stderr) {
                        if (stdout.indexOf("TV is off") !== -1) {
                            // Screen is OFF, turn it ON
                            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", function(error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                        } else if (stdout.indexOf("HDMI") !== -1) {
                            // Screen is ON, turn it OFF
                            exec("tvservice -o", function(error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                        }
                        self.checkForExecError(error, stdout, stderr);
                        self.handleEvDevKeyPressEventsCallback(true);
                    });
                break;
            default:
                // Should never get here, but OK:
                console.log("MMM-KeyBindings Helper received request to process a KEYPRESS of " + payload.KeyName + ":" +
                    payload.KeyState + ", but there is no handler for this key.");
                this.handleEvDevKeyPressEventsCallback(false);
        }
    },

    handleEvDevKeyPressEventsCallback: function(handled) {
        if (this.currentPayload && !handled) {
            this.currentPayload.SpecialKeys.splice(0, 1);
            this.sendSocketNotification("KEYPRESS", this.currentPayload);
        }
        this.currentPayload = null;
    },

    // Override socketNotificationReceived method.

    /* socketNotificationReceived(notification, payload)
     * This method is called when a socket notification arrives.
     *
     * argument notification string - The identifier of the noitication.
     * argument payload mixed - The payload of the notification.
     */
    socketNotificationReceived: function(notification, payload) {
        if (notification === "ENABLE_RESTNOTIFYSERVER") {
            if (!this.notifyServerCreated) {
                this.createNotifyServer();
            }
        }
        if (notification === "ENABLE_EVDEV") {
            if (!this.evdevMonitorCreated) {
                this.evdevConfig = payload;
                this.startEvdevMonitor();
            }
        }
        if (notification === "PROCESS_KEYPRESS") {
            this.handleEvDevKeyPressEvents(payload);
        }
    },

    checkForExecError: function(error, stdout, stderr) {
        if (stderr) {
            console.log('stderr: "' + stderr + '"');
            return 1;
        }
        if (error !== null) {
            console.log('exec error: ' + error);
            return 1;
        }
        return 0;
    },
});