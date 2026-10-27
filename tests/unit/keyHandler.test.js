/* Unit tests for keyHandler.js using Node's built-in test runner */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test, describe} = require("node:test");

function loadKeyHandlerModule () {
  const sourcePath = path.resolve(__dirname, "../../keyHandler.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const sandbox = {console};
  sandbox.globalThis = sandbox;

  vm.runInNewContext(
    `${source}\n;globalThis.testExports = {KeyHandler};`,
    sandbox,
    {filename: sourcePath}
  );

  return {
    ...sandbox.testExports
  };
}

const {KeyHandler} = loadKeyHandlerModule();

function plainObject (value) {
  return JSON.parse(JSON.stringify(value));
}

describe("KeyHandler.invertMap", () => {
  test("swaps keys and values correctly", () => {
    const input = {
      key1: "value1",
      key2: "value2",
      key3: "value3"
    };
    const output = KeyHandler.invertMap(input);
    assert.deepEqual(plainObject(output), {
      value1: "key1",
      value2: "key2",
      value3: "key3"
    });
  });

  test("handles empty object", () => {
    const input = {};
    const output = KeyHandler.invertMap(input);
    assert.deepEqual(plainObject(output), {});
  });

  test("handles single entry", () => {
    const input = {key: "value"};
    const output = KeyHandler.invertMap(input);
    assert.deepEqual(plainObject(output), {value: "key"});
  });

  test("handles special characters in keys and values", () => {
    const input = {
      KEY_LEFT: "ArrowLeft",
      KEY_RIGHT: "ArrowRight"
    };
    const output = KeyHandler.invertMap(input);
    assert.deepEqual(plainObject(output), {
      ArrowLeft: "KEY_LEFT",
      ArrowRight: "KEY_RIGHT"
    });
  });

  test("returns a new object (does not mutate input)", () => {
    const input = {key: "value"};
    const output = KeyHandler.invertMap(input);
    assert.notEqual(input, output);
    assert.deepEqual(input, {key: "value"});
  });
});

describe("KeyHandler class", () => {
  test("exposes the expected default configuration", () => {
    assert.equal(KeyHandler.prototype.defaults.mode, "DEFAULT");
    assert.deepEqual(plainObject(KeyHandler.prototype.defaults.map), {
      Right: "ArrowRight",
      Left: "ArrowLeft"
    });
  });

  test("creates class-based handlers with isolated key maps", () => {
    class ClassHandler extends KeyHandler {}

    KeyHandler.register("ClassHandler", ClassHandler);

    const firstHandler = KeyHandler.create("ClassHandler", {
      map: {
        Up: "ArrowUp"
      }
    });
    const secondHandler = KeyHandler.create("ClassHandler", {
      map: {
        Down: "ArrowDown"
      }
    });

    assert.ok(firstHandler instanceof KeyHandler);
    assert.ok(firstHandler instanceof ClassHandler);
    assert.equal(firstHandler.name, "ClassHandler");
    assert.deepEqual(plainObject(firstHandler.config.map), {
      Up: "ArrowUp"
    });

    firstHandler.config.map.Up = "ArrowRight";

    assert.deepEqual(plainObject(secondHandler.config.map), {
      Down: "ArrowDown"
    });
  });

  test("invokes an optional key press callback", () => {
    const keyPresses = [];

    KeyHandler.register("CallbackHandler", KeyHandler);
    const handler = KeyHandler.create("CallbackHandler", {}, {
      onKeyPress: (kp) => keyPresses.push(kp.keyName)
    });

    handler.validate("KEYPRESS", {
      keyName: "ArrowRight",
      keyState: "KEY_PRESSED"
    });

    assert.deepEqual(keyPresses, ["ArrowRight"]);
  });

  test("matches takeFocus object configurations by key name and state", () => {
    const handler = new KeyHandler();
    handler.focusReceived = function focusReceived () {
      this.focused = true;
    };
    handler.init("FocusHandler", {
      mode: "FOCUS",
      takeFocus: {
        keyName: "Enter",
        keyState: "KEY_LONGPRESSED"
      }
    });

    assert.equal(handler.validate("KEYPRESS", {
      keyName: "ArrowRight",
      keyState: "KEY_LONGPRESSED",
      sender: "SERVER",
      instance: "SERVER"
    }), false);
    assert.equal(handler.focused, undefined);

    assert.equal(handler.validate("KEYPRESS", {
      keyName: "Enter",
      keyState: "KEY_LONGPRESSED",
      sender: "SERVER",
      instance: "SERVER"
    }), true);
    assert.equal(handler.focused, true);
  });

  test("rejects plain-object handler registrations", () => {
    assert.throws(
      () => KeyHandler.register("LegacyHandler", {}),
      /KeyHandler definitions must be KeyHandler subclasses/u
    );
  });

  test("returns undefined for unknown handlers", () => {
    assert.equal(KeyHandler.create("DoesNotExist", {}), undefined);
  });
});
