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
    read (fd) {
      readFileDescriptors.push(fd);
    },
    access () {
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
    clearInterval,
    console,
    module: {exports: {}},
    process: {arch: "x64"},
    require: mockRequire,
    setImmediate,
    setInterval
  }, {filename: sourcePath});

  return {closedFileDescriptors, errors, helper: helperDefinition, logs, openCallbacks, readFileDescriptors};
}

function enableEvdev (eventPath) {
  const loaded = loadNodeHelper();
  loaded.helper.start();
  loaded.helper.socketNotificationReceived("ENABLE_EVDEV", {eventPath});
  return loaded;
}

describe("node helper evdev configuration", () => {
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
