const NodeHelper = require("node_helper");
const Log = require("logger");
const fs = require("node:fs");
const KEY_CODES = require("./keycodes.js");

/**
 * Linux input event types
 * @see https://www.kernel.org/doc/html/latest/input/event-codes.html
 */
const EV_KEY = 0x01;

/**
 * Size of input_event struct depends on architecture.
 * 64-bit: 24 bytes (8+8+2+2+4)
 * 32-bit: 16 bytes (4+4+2+2+4)
 */
const EVENT_SIZE = process.arch === "arm"
  ? 16
  : 24;
const TIME_SIZE = process.arch === "arm"
  ? 8
  : 16;

/**
 * Pure JavaScript implementation of Linux evdev input reader.
 * Reads directly from /dev/input/event* devices without native dependencies.
 */
class InputEventReader {
  /**
   * @param {string} devicePath - Path to the input device (e.g., /dev/input/btremote)
   * @param {Function} onKeyPress - Callback for key events: (keyName, keyState)
   */
  constructor (devicePath, onKeyPress) {
    this.devicePath = devicePath;
    this.onKey = onKeyPress;
    this.fd = null;
    this.isRunning = false;
    this.reconnectInterval = null;
    this.pendingKeyPress = {};

    Log.log(`Create InputEventReader for ${devicePath}`);
  }

  /**
   * Start reading from the input device
   */
  start () {
    this.isRunning = true;
    this.openDevice();
  }

  /**
   * Open the device and start reading events
   */
  openDevice () {
    // Clear any existing reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    fs.open(this.devicePath, "r", (err, fd) => {
      if (err) {
        if (err.code === "EACCES") {
          Log.error(`Permission denied for ${this.devicePath}`);
          Log.error("Make sure your user is in the 'input' group: sudo usermod -aG input $USER (then logout/login)");
          this.waitForDevice();
          return;
        }
        if (err.code === "ENOENT" || err.code === "ENODEV") {
          Log.info(`Device not available at ${this.devicePath}: ${err.code}, waiting for device…`);
          this.waitForDevice();
        } else {
          Log.error(`Error opening device: ${err}`);
        }
        return;
      }

      this.fd = fd;
      Log.log(`Connected to input device: ${this.devicePath}`);

      // Start reading events
      this.readEvents();
    });
  }

  /**
   * Read events from the device in a loop
   */
  readEvents () {
    if (!this.isRunning || this.fd === null) {
      return;
    }

    const buffer = Buffer.alloc(EVENT_SIZE);

    fs.read(this.fd, buffer, 0, EVENT_SIZE, null, (err, bytesRead) => {
      if (err) {
        if (err.code === "ENODEV") {
          Log.info("Device disconnected, waiting for reconnection…");
          this.closeDevice();
          this.waitForDevice();
        } else {
          Log.error(`Read error: ${err}`);
        }
        return;
      }

      if (bytesRead === EVENT_SIZE) {
        this.parseEvent(buffer);
      }

      // Continue reading (async recursion)
      setImmediate(() => this.readEvents());
    });
  }

  /**
   * Parse a single input event from the buffer
   * @param {Buffer} buffer - The raw event data
   */
  parseEvent (buffer) {
    // Skip time fields, read type, code, value
    const type = buffer.readUInt16LE(TIME_SIZE);
    const code = buffer.readUInt16LE(TIME_SIZE + 2);
    const value = buffer.readInt32LE(TIME_SIZE + 4);

    // Only process key events (EV_KEY)
    if (type !== EV_KEY) {
      return;
    }

    const keyName = KEY_CODES[code] || `KEY_${code}`;
    Log.debug(`Key event: ${keyName} (code: ${code}, value: ${value})`);

    // value: 0 = released, 1 = pressed, 2 = repeated (held/long press)
    if (value > 0) {
      // Key pressed or held
      this.pendingKeyPress.code = code;
      this.pendingKeyPress.keyName = keyName;
      this.pendingKeyPress.value = value;
    } else {
      // Key released - determine if it was a short or long press
      if (this.pendingKeyPress.code === code) {
        const keyState = this.pendingKeyPress.value === 2
          ? "KEY_LONGPRESSED"
          : "KEY_PRESSED";
        Log.log(`${keyName} ${keyState === "KEY_LONGPRESSED"
          ? "long "
          : ""}pressed.`);
        this.onKey(keyName, keyState);
      }
      this.pendingKeyPress = {};
    }
  }

  /**
   * Wait for the device to become available
   */
  waitForDevice () {
    if (this.reconnectInterval) {
      return;
    }

    this.reconnectInterval = setInterval(() => {
      Log.debug("Checking for device reconnection...");

      // Check if device exists
      fs.access(this.devicePath, fs.constants.R_OK, (err) => {
        if (!err && this.isRunning) {
          Log.log("Device available, attempting to reconnect...");
          this.openDevice();
        }
      });
    }, 5000);

    Log.log("Monitoring for device reconnections...");
  }

  /**
   * Close the device file descriptor
   */
  closeDevice () {
    if (this.fd !== null) {
      fs.close(this.fd, (err) => {
        if (err) {
          Log.debug(`Error closing fd: ${err.message}`);
        }
      });
      this.fd = null;
    }
  }

  /**
   * Stop reading and close the device
   */
  close () {
    Log.log(`Closing reader for ${this.devicePath}`);
    this.isRunning = false;

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    this.closeDevice();
  }
}

module.exports = NodeHelper.create({
  start () {
    Log.log("MMM-KeyBindings helper has started…");
    this.evdevMonitorCreated = false;
    this.readers = [];
  },

  stop () {
    if (this.evdevMonitorCreated) {
      this.readers.forEach((reader) => {
        reader.close();
      });
    }
  },

  socketNotificationReceived (notification, payload) {
    if (notification === "ENABLE_EVDEV") {
      if (!this.evdevMonitorCreated) {
        if (!payload.eventPath) {
          Log.error("MMM-KeyBindings: evdev is enabled but 'eventPath' is not configured!");
          Log.error("MMM-KeyBindings: Please add eventPath to your config, e.g.: evdev: { enabled: true, eventPath: '/dev/input/btremote' }");
          return;
        }

        const paths = payload.eventPath.split(",").map((p) => p.trim());

        this.readers = paths.map((devicePath) => {
          const reader = new InputEventReader(devicePath, (keyName, keyState) => {
            this.sendSocketNotification("KEYPRESS", {
              keyName,
              keyState
            });
          });
          return reader;
        });

        this.readers.forEach((reader) => {
          reader.start();
        });

        this.evdevMonitorCreated = true;
      }
    }
  }
});
