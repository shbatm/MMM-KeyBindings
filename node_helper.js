const NodeHelper = require("node_helper");
const Log = require("logger");

let evdev;
let usb;

class EvDevHandler {
  constructor (path, usbModule, onKeyPress) {
    this.evdevPath = path;
    this.usb = usbModule;
    this.onKey = onKeyPress;
    this.isMonitoring = false;
    Log.log(`[MMM-KeyBindings] Create EvDevHandler for ${path}`);
  }

  close () {
    Log.log(`[MMM-KeyBindings] EVDEV: Closing monitor and reader of ${this.evdevPath}`);

    // Clear reconnect interval if it exists
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    try {
      if (this.isMonitoring) {
        this.isMonitoring = false;
      }
    } catch (error) {
      Log.error(`[MMM-KeyBindings] ${error}`);
    }
    try {
      if (this.evdevReader) {
        this.evdevReader.close();
      }
    } catch (error) {
      Log.error(`[MMM-KeyBindings] ${error}`);
    }
  }

  startMonitor () {
    this.evdevReader = new evdev();
    this.pendingKeyPress = {};

    this.evdevReader
      .on("EV_KEY", (data) => {
        Log.debug("[MMM-KeyBindings] key : ", data.code, data.value);
        if (data.value > 0) {
          this.pendingKeyPress.code = data.code;
          this.pendingKeyPress.value = data.value;
        } else {
          if (
            "code" in this.pendingKeyPress &&
            this.pendingKeyPress.code === data.code
          ) {
            Log.log(`[MMM-KeyBindings] ${this.pendingKeyPress.code} ${
              this.pendingKeyPress.value === 2
                ? "long "
                : ""
            }pressed.`);
            this.onKey(
              data.code,
              this.pendingKeyPress.value === 2
                ? "KEY_LONGPRESSED"
                : "KEY_PRESSED"
            );
          }
          this.pendingKeyPress = {};
        }
      })
      .on("error", (error) => {
        if (error.code === "ENODEV" || error.code === "ENOENT") {
          Log.info(`[MMM-KeyBindings] EVDEV: Device not connected, nothing at path ${error.path}, waiting for device…`);
          this.waitForDevice();
        } else {
          Log.error(`[MMM-KeyBindings] EVDEV: ${error}`);
        }
      });

    this.setupDevice();
  }

  setupDevice () {
    this.device = this.evdevReader.open(this.evdevPath);
    this.device.on("open", () => {
      Log.log(`[MMM-KeyBindings] EVDEV: Connected to device: ${JSON.stringify(this.device.id)}`);
    });
    this.device.on("close", () => {
      Log.debug("[MMM-KeyBindings] EVDEV: Connection to device has been closed.");
      this.waitForDevice();
    });
  }

  waitForDevice () {
    if (!this.isMonitoring) {
      this.isMonitoring = true;

      /*
       * Simple polling mechanism for device reconnection
       * (usb module doesn't support attach events like udev did)
       */
      this.reconnectInterval = setInterval(() => {
        Log.log("[MMM-KeyBindings] Checking for device reconnection...");
        try {
          this.setupDevice();
        } catch {
          // Device still not available, continue polling
          Log.debug("[MMM-KeyBindings] Device not yet available, continuing to poll...");
        }
      }, 5000); // Check every 5 seconds

      Log.log("[MMM-KeyBindings] Monitoring for device reconnections...");
    }
  }
}

module.exports = NodeHelper.create({
  start () {
    Log.log("MMM-KeyBindings helper has started…");
    this.evdevMonitorCreated = false;
    this.handlers = [];
  },

  stop () {
    if (this.evdevMonitorCreated) {
      this.handlers.forEach((handler) => {
        handler.close();
      });
    }
  },

  socketNotificationReceived (notification, payload) {
    const self = this;
    if (notification === "ENABLE_EVDEV") {
      if (!this.evdevMonitorCreated) {
        evdev = require("evdev");
        usb = require("usb");
        const paths = payload.eventPath.split(",");
        this.handlers = paths.map((path) => new EvDevHandler(path, usb, (name, state) => {
          self.sendSocketNotification("KEYPRESS", {
            keyName: name,
            keyState: state
          });
        }));
        this.handlers.forEach((handler) => {
          handler.startMonitor();
        });
        this.evdevMonitorCreated = true;
      }
    }
  }
});
