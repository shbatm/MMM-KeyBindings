/* global Module */

/* Magic Mirror
 * Module: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

Module.register("MMM-KeyBindings", {
	// defaults: {
	// 	enabledKeyStates: ['KEY_DOWN'] // Options are 'KEY_UP', 'KEY_DOWN', 'KEY_HOLD'
	// },

	requiresVersion: "2.1.0", // Required version of MagicMirror

	// start: function() {
	// 	var self = this;
	// 	// Nothing to do...
	// },


	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		console.log("Working notification system. Notification:", notification, "payload: ", payload);
	},
		// if (notification === "KEYPRESS") {
		// 	console.log("KEYPRESS EVENT");
		// 	if (typeof payload != "undefined") {
		// 		console.log(self.config.enabledKeyStates);
		// 		if (self.config.enabledKeyStates.indexOf(payload.KeyState) > 0) {
		// 			this.sendNotification('KEYPRESS', payload);
		// 			console.log("Notification:", notification, "payload: ", payload);
		// 		}
		// 	}
		// }

});
