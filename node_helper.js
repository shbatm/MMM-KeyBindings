const NodeHelper = require("node_helper");
const Log = require("logger");

let evdev;
let udev;

class EvDevHandler {
  constructor (path, uDev, onKeyPress) {
    this.evdevPath = path;
    this.udev = uDev;
    this.onKey = onKeyPress;
    Log.log(`Create EvDevHandler for ${path}`);
  }

  close () {
    Log.log(`EVDEV: Closing monitor and reader of ${this.evdevPath}`);
    try {
      this.udevMonitor.close();
    } catch (error) {
      if (
        error.toString().indexOf("Cannot read property 'close' of undefined") === -1
      ) {
        Log.error(error);
      }
    }
    try {
      this.evdevReader.close();
    } catch (error) {
      Log.error(error);
    }
  }

  startMonitor () {
    this.evdevReader = new evdev();
    this.pendingKeyPress = {};

    this.evdevReader
      .on("EV_KEY", (data) => {
        Log.debug("key : ", data.code, data.value);
        if (data.value > 0) {
          this.pendingKeyPress.code = data.code;
          this.pendingKeyPress.value = data.value;
        } else {
          if (
            "code" in this.pendingKeyPress &&
            this.pendingKeyPress.code === data.code
          ) {
            Log.log(`${this.pendingKeyPress.code} ${
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
          Log.info(`EVDEV: Device not connected, nothing at path ${error.path}, waiting for device…`);
          this.waitForDevice();
        } else {
          Log.error("EVDEV: ", error);
        }
      });

    this.setupDevice();
  }

  setupDevice () {
    this.device = this.evdevReader.open(this.evdevPath);
    this.device.on("open", () => {
      Log.log(`EVDEV: Connected to device: ${JSON.stringify(this.device.id)}`);
    });
    this.device.on("close", () => {
      Log.debug("EVDEV: Connection to device has been closed.");
      this.waitForDevice();
    });
  }

  waitForDevice () {
    this.udevMonitor = this.udev.monitor();
    this.udevMonitor.on("add", (device) => {
      if ("DEVLINKS" in device && device.DEVLINKS === this.evdevPath) {
        Log.log("UDEV: Device connected.");
        this.udevMonitor.close();
        this.setupDevice();
      }
    });
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
        udev = require("udev");
        const paths = payload.eventPath.split(",");
        this.handlers = paths.map((path) => new EvDevHandler(path, udev, (name, state) => {
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
