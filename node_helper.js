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

		// Start the Python Daemon to capture input from FireTV Remote via Bluetooth
		// Python Daemon captures inputs using python-evdev and is configured to capture 
		// All events from '/dev/input/event0'.  Use `cat /proc/bus/input/devices` to find the 
		// correct handler to use.  You can also use `evtest /dev/input/event0` to monitor the output.
		// Note: to stop capturing input without shutting down the mirror, run the following from
		// a shell prompt: `python ~/MagicMirror/modules/MMM-KeyBindings/daemon.py stop`
		var spawn = require('child_process').spawn;
		// var daemon = spawn("python",["/home/pi/MagicMirror/modules/MMM-KeyBindings/daemon.py", "start"]);
		var daemon = spawn("python",[require("path").resolve(__dirname,"daemon.py"), "start"]);


		daemon.stderr.on('data', (data) => { 
			console.log(`MMM-KeyBindings daemon.py stderr: ${data}`);
		});

		daemon.stdout.on('data', (data) => {
			console.log(`MMM-KeyBindings daemon.py stderr: ${data}`);
		});

		daemon.on('close', (code) => {
			console.log(`MMM-KeyBindings daemon.py exited with code ${code}`);
		});
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

	// Override socketNotificationReceived method.

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function(notification, payload) {
		var self = this;

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
