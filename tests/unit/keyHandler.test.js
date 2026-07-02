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
    `${source}\n;globalThis.testExports = { KeyHandler, invertMap };`,
    sandbox,
    {filename: sourcePath}
  );

  return {
    ...sandbox.testExports,
    sandbox
  };
}

const {KeyHandler, invertMap, sandbox} = loadKeyHandlerModule();

function plainObject (value) {
  return JSON.parse(JSON.stringify(value));
}

describe("invertMap utility function", () => {
  test("swaps keys and values correctly", () => {
    const input = {
      key1: "value1",
      key2: "value2",
      key3: "value3"
    };
    const output = invertMap(input);
    assert.deepEqual(plainObject(output), {
      value1: "key1",
      value2: "key2",
      value3: "key3"
    });
  });

  test("handles empty object", () => {
    const input = {};
    const output = invertMap(input);
    assert.deepEqual(plainObject(output), {});
  });

  test("handles single entry", () => {
    const input = {key: "value"};
    const output = invertMap(input);
    assert.deepEqual(plainObject(output), {value: "key"});
  });

  test("handles special characters in keys and values", () => {
    const input = {
      KEY_LEFT: "ArrowLeft",
      KEY_RIGHT: "ArrowRight"
    };
    const output = invertMap(input);
    assert.deepEqual(plainObject(output), {
      ArrowLeft: "KEY_LEFT",
      ArrowRight: "KEY_RIGHT"
    });
  });

  test("returns a new object (does not mutate input)", () => {
    const input = {key: "value"};
    const output = invertMap(input);
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

  test("normalizes legacy object registrations into KeyHandler instances", () => {
    const warnings = [];
    sandbox.Log = {
      warn (message) {
        warnings.push(message);
      }
    };

    KeyHandler.register("LegacyHandler", {
      defaults: {
        mode: "LEGACY",
        map: {
          Left: "ArrowLeft"
        },
        multiInstance: false,
        takeFocus: "Enter",
        debug: false
      },
      validKeyPress () {
        return this.name;
      }
    });

    const firstHandler = KeyHandler.create("LegacyHandler", {
      map: {
        Left: "ArrowLeft"
      }
    });
    const secondHandler = KeyHandler.create("LegacyHandler", {
      map: {
        Right: "ArrowRight"
      }
    });

    assert.ok(firstHandler instanceof KeyHandler);
    assert.equal(firstHandler.name, "LegacyHandler");
    assert.equal(typeof firstHandler.validKeyPress, "function");
    assert.equal(firstHandler.config.mode, "LEGACY");
    assert.deepEqual(plainObject(firstHandler.config.map), {
      Left: "ArrowLeft"
    });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /deprecated/iu);

    firstHandler.config.map.Left = "ArrowRight";

    assert.deepEqual(plainObject(secondHandler.config.map), {
      Right: "ArrowRight"
    });
  });

  test("returns undefined for unknown handlers", () => {
    assert.equal(KeyHandler.create("DoesNotExist", {}), undefined);
  });
});
