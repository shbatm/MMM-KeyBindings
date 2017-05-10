/* global Module */

/* Magic Mirror
 * Module: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

Module.register("MMM-KeyBindings", {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		var self = this;
		var dataRequest = null;
		var dataNotification = null;

		//Flag for check if module is loaded
		this.loaded = false;

		this.addKeyboardEventListeners();

		this.loaded = true;
	},


	addKeyboardEventListeners: function() {
		document.addEventListener('keypress', (event) => {
		  const keyName = event.key;

		  console.log(keyName);

		  // As the user release the Ctrl key, the key is no longer active.
		  // So event.ctrlKey is false.
		  // if (keyName === 'Control') {
		  //   alert('Control key was released');
		  // }
		}, false);

		this.sendSocketNotification("MMM-KeyBindings-KEYPRESS_BINDINGS_ADDED", data);
	},

	getDom: function() {
		var self = this;

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		return wrapper;
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		if(notification === "MMM-KeyBindings-KEYPRESS_BINDINGS_ADDED") {
			console.log("Notification Received");
		}
	},
});
