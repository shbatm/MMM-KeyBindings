/* Unit tests for node_helper.js using mocked MagicMirror dependencies */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test, describe} = require("node:test");

function loadNodeHelper () {
  const sourcePath = path.resolve(__dirname, "../../node_helper.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const errors = [];
  const logs = [];
  const openCallbacks = [];
  const readCallbacks = [];
  const accessCallbacks = [];
  const intervalCallbacks = [];
  const clearedIntervalIds = [];
  const closedFileDescriptors = [];
  const readFileDescriptors = [];
  const helperDefinition = {};
  const logger = {
    error (message) {
      errors.push(message);
    },
    log (message) {
      logs.push(message);
    },
    info (message) {
      logs.push(message);
    },
    debug (message) {
      logs.push(message);
    }
  };
  const fsMock = {
    constants: {R_OK: 4},
    open (devicePath, flags, callback) {
      openCallbacks.push(callback);
    },
    close (fd, callback) {
      closedFileDescriptors.push(fd);
      callback(null);
    },
    read (...args) {
      readFileDescriptors.push(args[0]);
      readCallbacks.push(args[5]);
    },
    access (devicePath, mode, callback) {
      accessCallbacks.push(callback);
      return undefined;
    }
  };
  const mockRequire = (request) => {
    if (request === "node_helper") {
      return {
        create (definition) {
          Object.assign(helperDefinition, definition);
          return definition;
        }
      };
    }
    if (request === "logger") {
      return logger;
    }
    if (request === "node:fs") {
      return fsMock;
    }
    if (request === "./keycodes.js") {
      return require("../../keycodes.js");
    }
    throw new Error(`Unexpected dependency: ${request}`);
  };

  vm.runInNewContext(source, {
    Buffer,
    clearInterval (intervalId) {
      clearedIntervalIds.push(intervalId);
    },
    console,
    module: {exports: {}},
    process: {arch: "x64"},
    require: mockRequire,
    setImmediate,
    setInterval (callback) {
      intervalCallbacks.push(callback);
      return intervalCallbacks.length;
    }
  }, {filename: sourcePath});

  return {
    accessCallbacks,
    clearedIntervalIds,
    closedFileDescriptors,
    errors,
    helper: helperDefinition,
    intervalCallbacks,
    logs,
    openCallbacks,
    readCallbacks,
    readFileDescriptors
  };
}

function enableEvdev (eventPath) {
  const loaded = loadNodeHelper();
  loaded.helper.start();
  loaded.helper.socketNotificationReceived("ENABLE_EVDEV", {eventPath});
  return loaded;
}

function createKeyEvent (code, value) {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt16LE(1, 16);
  buffer.writeUInt16LE(code, 18);
  buffer.writeInt32LE(value, 20);
  return buffer;
}

describe("node helper evdev lifecycle and configuration", () => {
  test("creates one reader for a single event path", () => {
    const {helper} = enableEvdev(["/dev/input/remote"]);

    assert.deepEqual(helper.readers.map((reader) => reader.devicePath), ["/dev/input/remote"]);
  });

  test("creates readers for multiple event paths", () => {
    const {helper} = enableEvdev([
      "/dev/input/remote-keyboard",
      "/dev/input/remote-media"
    ]);

    assert.deepEqual(helper.readers.map((reader) => reader.devicePath), [
      "/dev/input/remote-keyboard",
      "/dev/input/remote-media"
    ]);
  });

  test("tracks overlapping key presses independently", () => {
    const {helper} = enableEvdev(["/dev/input/remote"]);
    const [reader] = helper.readers;
    const keyPresses = [];
    reader.onKey = (keyName, keyState) => keyPresses.push({keyName, keyState});

    reader.parseEvent(createKeyEvent(105, 1));
    reader.parseEvent(createKeyEvent(106, 1));
    reader.parseEvent(createKeyEvent(106, 2));
    reader.parseEvent(createKeyEvent(105, 0));
    reader.parseEvent(createKeyEvent(106, 0));

    assert.deepEqual(keyPresses, [
      {keyName: "KEY_LEFT", keyState: "KEY_PRESSED"},
      {keyName: "KEY_RIGHT", keyState: "KEY_LONGPRESSED"}
    ]);
    reader.close();
  });

  test("ignores a stale open after the reader stops and restarts", () => {
    const {closedFileDescriptors, helper, openCallbacks, readFileDescriptors} = enableEvdev(["/dev/input/remote"]);
    const [reader] = helper.readers;

    reader.close();
    reader.start();
    openCallbacks[0](null, 42);

    assert.deepEqual(closedFileDescriptors, [42]);
    assert.deepEqual(readFileDescriptors, []);
    assert.equal(reader.fd, null);

    openCallbacks[1](null, 43);

    assert.deepEqual(readFileDescriptors, [43]);
    assert.equal(reader.fd, 43);
    reader.close();
  });

  test("closes the device when the reader stops", () => {
    const {closedFileDescriptors, helper, openCallbacks, readFileDescriptors} = enableEvdev(["/dev/input/remote"]);
    const [reader] = helper.readers;

    openCallbacks[0](null, 42);
    reader.close();

    assert.equal(reader.fd, null);
    assert.deepEqual(closedFileDescriptors, [42]);
    assert.deepEqual(readFileDescriptors, [42]);
  });

  test("reopens a device after it becomes available", () => {
    const {helper, intervalCallbacks, openCallbacks, readFileDescriptors, accessCallbacks} = enableEvdev(["/dev/input/remote"]);
    const [reader] = helper.readers;

    openCallbacks[0]({code: "ENOENT"});
    intervalCallbacks[0]();
    accessCallbacks[0](null);
    openCallbacks[1](null, 42);

    assert.equal(reader.fd, 42);
    assert.deepEqual(readFileDescriptors, [42]);
    reader.close();
  });

  test("does not reconnect after stopping during device disconnection", () => {
    const {accessCallbacks, closedFileDescriptors, clearedIntervalIds, helper, intervalCallbacks, openCallbacks, readCallbacks} = enableEvdev(["/dev/input/remote"]);
    const [reader] = helper.readers;

    openCallbacks[0](null, 42);
    readCallbacks[0]({code: "ENODEV"});
    reader.close();
    intervalCallbacks[0]();
    accessCallbacks[0](null);

    assert.deepEqual(closedFileDescriptors, [42]);
    assert.deepEqual(clearedIntervalIds, [1]);
    assert.equal(openCallbacks.length, 1);
    assert.equal(reader.reconnectInterval, null);
  });

  test("trims paths and ignores empty or non-string entries", () => {
    const {helper} = enableEvdev([" /dev/input/remote ", "", 42, "  "]);

    assert.deepEqual(helper.readers.map((reader) => reader.devicePath), ["/dev/input/remote"]);
  });

  test("rejects the legacy comma-separated string form", () => {
    const {errors, helper} = enableEvdev("/dev/input/remote-keyboard,/dev/input/remote-media");

    assert.equal(helper.readers.length, 0);
    assert.match(errors[0], /eventPath.*not configured/u);
  });

  test("rejects an empty event path array", () => {
    const {errors, helper} = enableEvdev([]);

    assert.equal(helper.readers.length, 0);
    assert.match(errors[0], /eventPath.*not configured/u);
  });
});
