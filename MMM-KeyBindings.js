/* global Module */

/* Magic Mirror
 * Module: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

Module.register("MMM-KeyBindings", {
	defaults: {
		enabledKeyStates: ['KEY_DOWN'] // Options are 'KEY_UP', 'KEY_DOWN', 'KEY_HOLD'
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		var self = this;
		console.log(this.name + " has started...");

		this.sendSocketNotification("MMM-KeyBindings-NOTIFICATION_STARTUP", this.name);
		
		// Nothing else to do...
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		console.log("Working notification system. Notification:", notification, "payload: ", payload);
	},

});
