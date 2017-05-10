/* Magic Mirror
 * Node Helper: MMM-KeyBindings
 *
 * By shbatm
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({

	// Override socketNotificationReceived method.

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function(notification, payload) {
		if (notification === "MMM-KeyBindings-NOTIFICATION_TEST") {
			console.log("Working notification system. Notification:", notification, "payload: ", payload);
		}
	},

	// Example function send notification test
	sendNotificationTest: function(payload) {
		this.sendSocketNotification("MMM-KeyBindings-NOTIFICATION_TEST", payload);
	},
});
