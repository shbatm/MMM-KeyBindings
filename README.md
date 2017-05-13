# MMM-KeyBindings

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

The MMM-KeyBindings Module is a helper module that provides a method for controlling the MagicMirror² through a Bluetooth-connected Remote or through a keyboard by capturing button presses and keystrokes and either processing them or passing them on for use in other modules via notifications.

The primary features are:

1.  Captures input from an Amazon Fire Stick remote control using a python-based daemon to capture and process the input. See: [Why Fire Stick?](#WhyFire) and [Why python-evdev?](#WhyPython)
2.  Captures input from a standard keyboard on the local server or a remote screen. Basic navigation keys are captured, but this can be changed in the config.
3.  Creates a HTTP "Notify" server to allow module notifications to be sent via HTTP GET calls from an external source. See: [Why a Notify Server?](#WhyNotify)
4.  Assigns Special Keys that can be used to perform various actions such as turing on/off the screen.
5.  Special Keys are processed in a "queue" to allow multiple context-based assignments (e.g. one key will turn on the screen if it's off, otherwise it will open an On Screen Menu).
6.  Passes keys to other modules for action via notifcation.
7.  Allows a module to "take focus", allowing other modules to ingore keypresses when a particular module has focus (e.g. in a pop-up menu).

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

You can then configure other modules to handle the key presses and, if necessary, request focus so only that module will respond to the keys (e.g. for a menu).  See [Handling Keys](#HandlingKeys)

## Additional System Requirements

* Python v2.7.x
* `python-evdev` module (install via `pip install evdev`)

## Configuration options

| Option           | Description
|----------------- |-----------
| `option1`        | *Required* DESCRIPTION HERE
| `option2`        | *Optional* DESCRIPTION HERE TOO <br><br>**Type:** `int`(milliseconds) <br>Default 60000 milliseconds (1 minute)

## <a name="HandlingKeys"></a>Handling Keys in Another Module

### Receiving Key Presses
When a key is pressed, this module will send a module notification on with the following properties (if the key is not a special key, handled by this module):
```js
notification: "KEYPRESS"
payload: {  CurrentMode: "DEFAULT"  // "Mode" or "Focus" to respond to
            KeyCode: "Enter"        // The plain text key name pressed
            KeyState: "KEY_PRESSED" // What happened
            Sender: "SERVER"        // Source of the input.
}
```

| Parameter     | Description
|---------------|------------
|`CurrentMode`  | The current "Mode" or "Focus". "DEFAULT" is the default mode. Your module should check the mode and respond appropriately. See Changing Modes below.
|`KeyCode`      | The plain text name of the key that was pressed. Remote control keys are normalized to the Standard Keyboard Enumeration where possible.
|`KeyState`     | The type of key press. Options are:<br />`KEY_PRESSED` - a normal key press.<br />`KEY_LONGPRESSED` - a long key press.<br />`KEY_UP` or `keyup` - key released*<br />`KEY_DOWN` or `keydown` - key pressed* down<br />`KEY_HOLD` - a key being held*<br />* Raw Mode Only
|`Sender`       | The sender either "SERVER" if sent by evdev or a keyboard connected to the server running the mirror; otherwise it passes the hostname and port used to view the mirror.

### Changing Focus
A module can request focus or a "Mode" change one of two ways: 

1. Send a notification to request it:
    ```js
    this.sendNotification("KEYPRESS_MODE_CHANGED","MODE NAME");
    ```

2. Adding an External Interrupt Special Key (`extInterruptX`) in this module's config:<br />This has the advantage that it will short-circuit all other modules and the mode will be changed before sending out the keypress.

All subsequent key presses will be sent with the new mode. Make sure to release the focus when done by sending a mode change of "DEFAULT" back.

## Development Path
This module was created as a stepping stone to allow other modules to be tweaked to respond to keyboard presses--mainly for navigation purposes. Please add any requests via the Issues for this repo.

* Develop On Screen Menu with options similar to [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control) for controlling the underlying Mirror system (e.g. shutdown, restart, re-launch)
* Fork [MMM-Carousel](https://github.com/barnabycolby/MMM-Carousel) to implement page navigation by key presses.

## <a name="WhyFire"></a>Why Fire Stick?

The Amazon Fire Stick remote controls are simple 6-button + D-pad remotes that will connect easily to the Raspberry Pi Zero W and Raspberry Pi 3 built-in Bluetooth and act as an input device with no additional software. They're also cheap, and I've picked them up on eBay for as little as $10. You don't just have to use a Fire Stick remote though, any bluetooth or wireless presentation "clicker" or remote would work great; you just need to update the key map in the config. See: [Setting Up the Remote](#RemoteSetup).

<img src="https://raw.githubusercontent.com/shbatm/MMM-KeyBindings/master/img/fire_stick_remote.jpg" width="300">

## <a name="WhyPython"></a>Why python-evdev?

This module uses a separate Python script that runs in the background on the server and monitors the input device file for events. This method is used to capture input from the remote because (a) not all buttons are passed to the browser as keyboard events and (b) some that do get passed to the browser can't have their default function overridden.  Initially, the plan was to just create a module to capture keystrokes in the browser via pure JS; however, only the directional pad of the remote was passed as keystrokes. In addition, not only would the "Home" button not appear as a key press, it would also re-direct to the browser's homepage.

The method used in this module uses `python-evdev`, a python module which hooks into `evdev`, a Linux system subprocess that can receive events from an input device, such as the remote (or standard keyboards and mice). 

The script in this module runs in the background and monitors for input events via the input device handler's event file. It then processes these events as key presses and sends them to the MagicMirror via an HTTP GET call to the "Notify Server".

The script has a normal mode, which waits for both a `KEY_DOWN` and a `KEY_UP` event and then sends a `KEY_PRESSED` notification to the Mirror. It will also monitor the duration of the key press and will send `KEY_LONGPRESSED` if the button was held for longer than the set threshold.  This is useful for performing different tasks based on short and long key presses.  `rawMode` can also be enabled to send the individual `KEY_DOWN`, `KEY_UP`, and `KEY_HOLD` events to the Mirror.

The script runs using PM2 to monitor and reload if necessary.

## <a name="WhyNotify"></a>Why a Notify Server?

First, what is a "Notify" server?  This is simply an extra route added to the MagicMirror which takes in URL based notifications in the following form:
```
HTTP GET: http://localhost:8080/MMM-KeyBindings/notify?notification=##NOTIFICATION-TITLE##&payload=##JSON.STRINGIFY'D-PAYLOAD##
```

The purpose of the "Notify" server is two-fold: (1) it allows the python daemon to communicate easily with the MagicMirror and (2) if `enableRelayServer` is enabled in the config, it will accept URL notifcations and re-broadcast them internally to other modules.  This is useful for controlling other modules from an external source such as through an [ISY](https://www.universal-devices.com/residential/isy994i-series/) [Network Resources](https://wiki.universal-devices.com/index.php?title=ISY-994i_Series_INSTEON:Networking#Network_Resources).

