# MMM-KeyBindings

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

Module to provide keyboard or Bluetooth Remote Control key bindings to control various aspects of the MagicMirror through socket notifications

## Using the module

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        {
            module: 'MMM-KeyBindings',
            config: {
                // See below for configurable options
            }
        }
    ]
}
```

## Configuration options

| Option           | Description
|----------------- |-----------
| `option1`        | *Required* DESCRIPTION HERE
| `option2`        | *Optional* DESCRIPTION HERE TOO <br><br>**Type:** `int`(milliseconds) <br>Default 60000 milliseconds (1 minute)


## API
Sends a module notification on a keypress with the following properties:
```js
notification: "KEYPRESS"
payload: {  CurrentMode: "DEFAULT"  // "Mode" or "Focus" to respond to
            KeyCode: "Enter"        // The plain text key name pressed
            KeyState: "KEY_PRESSED" // What happened
            Sender: "SERVER"        // Source of the input.
}
```


## Python Script Requirements
python version

Modules:
python-evdev
watchdog
