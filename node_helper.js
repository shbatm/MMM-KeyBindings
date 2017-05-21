/* Magic Mirror
 * Node Helper: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */
 /* jshint node: true, esversion: 6*/
 
 "use strict";

var NodeHelper = require("node_helper");
var url = require("url");
const exec = require("child_process").exec;
// const os = require("os");


module.exports = NodeHelper.create({

    start: function() {
        console.log("MMM-KeyBindings helper has started...");
        this.notifyServerCreated = false;
        this.pythonDaemonEnabled = false;
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

    startPythonDaemon: function(args) {
        var self = this;
        // Start the Python Daemon to capture input from FireTV Remote via Bluetooth
        // Python Daemon captures inputs using python-evdev and is configured to capture 
        // All events from '/dev/input/event0'.  Use `cat /proc/bus/input/devices` to find the 
        // correct handler to use.  You can also use `evtest /dev/input/event0` to monitor the output.
        // Note: to stop capturing input without shutting down the mirror, run the following from
        // a shell prompt: `python ~/MagicMirror/modules/MMM-KeyBindings/daemon.py stop`
        // expected args: evdev: { enabled: true, eventPath:'', disableGrab: false, 
        //                          longPressDuration: 1.0, rawMode: false }
        //var daemonArgs = ['start', require("path").resolve(__dirname,"evdev_daemon.py"), "-f", "--name", "evdev",
        //                    "--", "--server", 'http://localhost:8080/' + this.name + '/notify'];

        var daemonArgs = ["--server", 'http://localhost:8080/' + this.name + '/notify'];
        var ENABLE_DAEMON_DEBUGGING = false;

        if (("eventPath" in args) && args.eventPath) {
            daemonArgs.push('--event');
            daemonArgs.push(args.eventPath);
        }
        if (("disableGrab" in args) && args.disableGrab) {
            daemonArgs.push('--no-grab');
        }
        if (("rawMode" in args) && args.rawMode) {
            daemonArgs.push('--raw');
        }
        if (("bluetooth" in args) && args.bluetooth) {
            daemonArgs.push('--bluetooth');
            daemonArgs.push(args.bluetooth);
        }
        if ("longPressDuration" in args) {
            if (typeof args.longPressDuration === "number") {
                daemonArgs.push('-l');
                daemonArgs.push(args.longPressDuration);
            } else if (typeof args.longPressDuration === "string") {
                daemonArgs.push('-l');
                daemonArgs.push(parseFloat(args.longPressDuration));
            }
        }
        if (ENABLE_DAEMON_DEBUGGING) {
            daemonArgs.push("-d");
            daemonArgs.push("-v");
        }

        console.log("Starting pm2 evdev:" + JSON.stringify(daemonArgs, null, 4));
        // Old method of starting process with PM2, changing to use native code.
        // var spawn = require('child_process').spawn;
        // var daemon = spawn("pm2", daemonArgs);

        // daemon.stderr.on('data', (data) => { 
        //     console.error(`MMM-KeyBindings daemon stderr: ${data}`);
        // });

        // daemon.stdout.on('data', (data) => {
        //     console.log(`MMM-KeyBindings daemon stdout: ${data}`);
        // });

        // daemon.on('close', (code) => {
        //     console.log(`MMM-KeyBindings daemon exited with code ${code}`);
        // });

        var pm2 = require('pm2');

        pm2.connect( (err) => {
          if (err) {
            console.error(err);
            process.exit(2);
          }

          // Stops the Daemon if it's already started
          pm2.list(function (err, list){        
            var errCB = function(err, apps) {
                if (err) { console.log(err); }
            };

            for (var proc in list) {
                if ("name" in list[proc] && list[proc].name === "evdev") {
                    if ("status" in list[proc] && list[proc].status === "online") {
                      console.log("PM2: evdev already running. Stopping old instance...")
                      pm2.stop('evdev', errCB);
                    }
                }
            }
          });
          
          pm2.start({
            script    : require("path").resolve(__dirname,"evdev_daemon.py"),
            name      : 'evdev',
            interpreter: 'python',
            interpreterArgs: '-u',
            args      : daemonArgs,
            max_memory_restart : '100M'   // Optional: Restarts your app if it reaches 100Mo
          }, function(err, apps) {
            pm2.disconnect();   // Disconnects from PM2
            if (err) { throw err; }
          });
        });

        this.pythonDaemonEnabled = true;
	console.log("MMM-KeyBindings Python Daemon Started.");
    },

    handleEvDevKeyPressEvents: function(payload) {
        var self = this;
        this.currentPayload = payload;
        var screenStatus;
        //console.log("Current Payload: " + JSON.stringify(payload, null, 4));
        switch (payload.SpecialKeys[0]) {
            case "screenPowerOn":
                screenStatus = exec("tvservice --status",
                       function (error, stdout, stderr) {
                          var handled = false;
                          if (stdout.indexOf("TV is off") !== -1) {
                            // Screen is OFF, turn it ON
                            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr); });
                            handled = true;
                          }
                          self.checkForExecError(error, stdout, stderr);
                          self.handleEvDevKeyPressEventsCallback(handled);
                       });              
                break;
            case "screenPowerOff":
                screenStatus = exec("tvservice --status",
                       function (error, stdout, stderr) {
                          var handled = false;
                          if (stdout.indexOf("HDMI") !== -1) {
                            // Screen is ON, turn it OFF
                            exec("tvservice -o", function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr); });
                            handled = true;
                          }
                          self.checkForExecError(error, stdout, stderr);
                          self.handleEvDevKeyPressEventsCallback(handled);
                       });
                break;
            case "screenPowerToggle":
                screenStatus = exec("tvservice --status",
                       function (error, stdout, stderr) {
                          if (stdout.indexOf("TV is off") !== -1) {
                            // Screen is OFF, turn it ON
                            exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr); });
                          } else if (stdout.indexOf("HDMI") !== -1) {
                            // Screen is ON, turn it OFF
                            exec("tvservice -o", function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr); });
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
            this.currentPayload.SpecialKeys.splice(0,1);
            this.sendSocketNotification("KEYPRESS", this.currentPayload);
            // console.log("Not handled. Sending back to processor.");
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
        if (notification === "ENABLE_PYTHONDAEMON") {
            if (this.notifyServerCreated && !this.pythonDaemonEnabled) {
                this.startPythonDaemon(payload);
            } else if (!this.pythonDaemonEnabled) {
                console.error("Cannot enable python daemon. Did the Notify server not get enabled?");
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
