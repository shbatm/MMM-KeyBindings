/* Magic Mirror
 * Node Helper: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var url = require("url");
const exec = require("child_process").exec;
const os = require("os");


module.exports = NodeHelper.create({

	start: function() {
		var self = this;

		console.log("MMM-KeyBindings helper has started...");
		this.restServerCreated = false;
		this.pythonDaemonEnabled = false;
	},

	// MODEL FOR EXECUTING CODE AND RETURNING OUTPUT:
	// child_proc = exec(command,
	// 				   function (error, stdout, stderr) {
	// 				      console.log('stdout: ' + stdout);
	// 				      console.log('stderr: ' + stderr);
	// 				      if (error !== null) {
	// 				          console.log('exec error: ' + error);
	// 				      }
	// 				   });

	createRestServer: function() {
		var self = this;
		// Basic URL Interface to accept push notifications formatted like
		// http://localhost:8080/MMM-KeyBindings/notify?notification=TITLE&payload=JSONstringifiedSTRING
		this.expressApp.get("/" + this.name + "/notify", (req, res) => {
			var query = url.parse(req.url, true).query;
			var notification = query.notification;
			var payload 
			try {
			  payload = JSON.parse(query.payload);
			} catch (e) {
			// Oh well, but whatever...
			}

			if (typeof payload === "undefined") {
				payload = [];
			}
			this.sendSocketNotification(notification, payload);
			res.sendStatus(200);
		});
	},

	startPythonDaemon: function(args) {
		var self = this;
		// Start the Python Daemon to capture input from FireTV Remote via Bluetooth
		// Python Daemon captures inputs using python-evdev and is configured to capture 
		// All events from '/dev/input/event0'.  Use `cat /proc/bus/input/devices` to find the 
		// correct handler to use.  You can also use `evtest /dev/input/event0` to monitor the output.
		// Note: to stop capturing input without shutting down the mirror, run the following from
		// a shell prompt: `python ~/MagicMirror/modules/MMM-KeyBindings/daemon.py stop`
		var spawn = require('child_process').spawn;

		// expected args: evdev: { enabled: true, event_path:'', disable_grab: false, 
		// 							long_press_duration: 1.0, raw_mode: false }
		var daemon_args = [require("path").resolve(__dirname,"daemon.py"), "restart", "--server", 
							'http://localhost:8080/' + this.name + '/notify'];	// TODO: Reference this.expressApp to get url
		if (("event_path" in args) && args.event_path) {
			daemon_args.push('--event');
			daemon_args.push(args.event_path);
		}
		if (("disable_grab" in args) && args.disable_grab) {
			daemon_args.push('--no-grab');
		}
		if (("raw_mode" in args) && args.raw_mode) {
			daemon_args.push('--raw');
		}
		if ("long_press_duration" in args) {
			if (typeof args.long_press_duration === "float" || typeof args.long_press_duration === "int") {
				daemon_args.push('-l');
				daemon_args.push(args.long_press_duration);
			} else if (typeof args.long_press_duration === "string") {
				daemon_args.push('-l');
				daemon_args.push(parseFloat(args.long_press_duration));
			}
		}

		var daemon = spawn("python", daemon_args);


		daemon.stderr.on('data', (data) => { 
			console.error(`MMM-KeyBindings daemon.py stderr: ${data}`);
		});

		daemon.stdout.on('data', (data) => {
			console.log(`MMM-KeyBindings daemon.py stdout: ${data}`);
		});

		daemon.on('close', (code) => {
			console.error(`MMM-KeyBindings daemon.py exited with code ${code}`);
		});
	},

	// Override socketNotificationReceived method.

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (notification === "ENABLE_RESTNOTIFYSERVER") {
			if (!this.restServerCreated) {
				this.createRestServer();
			}
		}
		if (notification === "ENABLE_PYTHONDAEMON") {
			if (this.restServerCreated && !this.pythonDaemonEnabled) {
				this.startPythonDaemon(payload);
			} else {
				console.error("Cannot enable python daemon. Did the REST server not get enabled?");
			}
		}

		if (notification === "PROCESS_KEYPRESS") {
			switch(payload.KeyName) {
			    case "!POWER_KEY":  // Specially assigned key to toggle power to Screen
			    	screen_status = exec("tvservice --status",
					   function (error, stdout, stderr) {
					   	  if (stdout.indexOf("TV is off") != -1) {
					   	  	// Screen is OFF, turn it ON
							exec("tvservice --preferred && sudo chvt 6 && sudo chvt 7", function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr); });
					   	  } else if (stdout.indexOf("HDMI") != -1) {
					   	  	// Screen is ON, turn it OFF
							exec("tvservice -o", function(error, stdout, stderr){ self.checkForExecError(error, stdout, stderr); });
					   	  }
					   	  self.checkForExecError(error, stdout, stderr);
					   });
			        break;
			    default:
			        console.log("MMM-KeyBindings Helper received request to process a KEYPRESS of " + payload.KeyName + ":" + 
			        		payload.KeyState + ", but there is no handler for this key.");
			}
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
