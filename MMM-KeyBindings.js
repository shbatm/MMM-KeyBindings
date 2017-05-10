/* global Module */

/* Magic Mirror
 * Module: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

Module.register("MMM-KeyBindings", {
	defaults: {
		keys: ['ArrowDown','ArrowLeft','ArrowRight','ArrowUp','Enter']
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		var self = this;

		this.addKeyboardEventListeners();
	},

	addKeyboardEventListeners: function() {
		document.addEventListener('keydown', (event) => {
		  const keyName = event.key;
		  if (event.preventDefault) {
		  	event.preventDefault();
		  } else {
		  	event.returnValue = false;
		  }
		  console.log(keyName);
		  this.sendNotification("KEYPRESS", { 'keyName':keyName, 'keyState':'KEY_UP' });
		}, false);

		this.sendSocketNotification("MMM-KeyBindings-KEYPRESS_BINDINGS_ADDED", "keypress");
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		console.log("Working notification system. Notification:", notification, "payload: ", payload);
		if(notification === "MMM-KeyBindings-KEYPRESS_BINDINGS_ADDED") {
			console.log("Notification Received");
		}
	},
});
