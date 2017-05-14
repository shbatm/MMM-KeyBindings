# MMM-KeyBindings

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

The MMM-KeyBindings Module is a helper module that provides a method for controlling the MagicMirror² through a Bluetooth-connected Remote or through a keyboard by capturing button presses and keystrokes and either processing them or passing them on for use in other modules via notifications.

The primary features are:

1.  Captures input from an Amazon Fire Stick remote control using a python-based daemon to capture and process the input. See: [Why Fire Stick?](#WhyFire) and [Why python-evdev?](#WhyPython)
2.  Captures input from a standard keyboard on the local server or a remote screen. Basic navigation keys are captured, but this can be changed in the config.
3.  Creates a HTTP "Notify" server to allow module notifications to be sent via HTTP GET calls from an external source. See: [Why a Notify Server?](#WhyNotify)
4.  Assigns Special Keys that can be used to perform various actions such as turing on/off the screen.
5.  Special Keys are processed in a "queue" to allow multiple context-based assignments (e.g. one key will turn on the screen if it's off, otherwise it will open an On Screen Menu). See [Special Keys](#SpecialKeys) below.
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

| Option                | Description
|-----------------------|-----------
| `enabledKeyStates`    | Array of Key States that the module should handle.  <br />*Default:* `KEY_PRESSED` & `KEY_LONGPRESSED`<br />*Available:* `KEY_UP`, `KEY_DOWN`, `KEY_HOLD` (these require `evdev.rawMode`) to be true to receive events.
| `handleKeys`          | Array of additional keys to handle in this module above the standard set,  <br /> Reference [Mousetrap API](https://craig.is/killing/mice) for the available key enumerations.
| `disableKeys`         | Array of keys to ignore from the default set.
| `enableNotifyServer`  | Allow the use of the HTTP GET "Notify" server. Default is `true`, can be set to `false` to use local keyboard keys only.
| `endableRelayServer`  | Enables non-"KEYPRESS" HTTP GET notifications to be passed through to other modules when received on the "Notify" server. Useful for enabling 3rd party communication with other modules. <br />*Default:* `true` <br />*Requires:* `enableNotifyServer: true`.
| `evdev: { enabled: true,`<br />`eventPath:'',`<br />`disableGrab: false,`<br />`longPressDuration: 0.7,`<br />`rawMode: false }` | Configuration options for the `python-evdev` daemon. <br />
| `eventPath` | Path to the event input file<br /> *Default:* `/dev/input/event0`, `''` uses the default path.
| `disableGrab` | By default, this script grabs all inputs from the device, which will block any commands from being passed natively. Set `disableGrab: true` to disable this behavior.
| `longPressDuration` | The threshold in seconds (as float) between a `KEY_PRESSED` and `KEY_LONGPRESSED` event firing.
| `rawMode` | Enables raw mode to send the individual `KEY_UP`, `KEY_DOWN`, `KEY_HOLD` events.
| `evdevKeymap`     | Map of the remote controls' key names (from `evtest`) to translate into standard keyboard event names. See Sample Key Map below.
| `specialKeys`     | List of Keys and KeyStates that map to special functions that will be handled by this module. See [Special Keys](#SpecialKeys) below.
| `extInterruptModes` | Array of "Modes" that can be set by assigning special keys. See [Special Keys](#SpecialKeys) below.

### Sample Key Map
```
evdevKeymap: {  
    Home: "KEY_HOMEPAGE", 
    Enter: "KEY_KPENTER", 
    ArrowLeft: "KEY_LEFT", 
    ArrowRight: "KEY_RIGHT", 
    ArrowUp: "KEY_UP", 
    ArrowDown: "KEY_DOWN",
    Menu: "KEY_MENU", 
    MediaPlayPause: "KEY_PLAYPAUSE", 
    MediaNextTrack: "KEY_FASTFORWARD", 
    MediaPreviousTrack: "KEY_REWIND",
    Return: "KEY_BACK"
},
```

### <a name="SpecialKeys"></a> Special Keys
Special Keys are keys and keystate pairs which can be used to perform special functions within the module.  They are processed in a queue in the order listed in the configuration. The same key can be assigned to multiple special keys for context-based situations -- for example, you can turn on the screen if it's off; if it's already on, the same key can be used to open a menu or do something else.  If the Special Key doesn't need to be processed (e.g. turning on a screen, but the screen is already on), then it will be passed along like a normal key press.

```
specialKeys: {  
    screenPowerOn: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_PRESSED" },
    screenPowerOff: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_LONGPRESSED" },
    screenPowerToggle: { KeyName:"", KeyState:"" },
    osdToggle: { KeyName:"KEY_HOMEPAGE", KeyState:"KEY_PRESSED" },
    extInterrupt1: { KeyName: "", KeyState: "" },
    extInterrupt2: { KeyName: "", KeyState: "" },
    extInterrupt3: { KeyName: "", KeyState: "" },
}, 
```

#### External Mode Interrupt Keys
Three of the special keys can be assigned to change the mode in combination with the `extInterruptModes` parameter.  For example, if you wanted the "KEY_MENU" key to always open a menu in another module and give that module focus, you could set:
```
    specialKeys: { extInterrupt1: { KeyName: "KEY_MENU", KeyState: "KEY_PRESSED" } }
    extInterruptModes: ["MY_MODULES_MENU"],
```

## <a name="HandlingKeys"></a>Handling Keys in Another Module

### Receiving Key Presses
When a key is pressed, this module will send a module notification on with the following properties (if the key is not a special key, handled by this module):
```js
notification: "KEYPRESS"
payload: {  CurrentMode: "DEFAULT",  // "Mode" or "Focus" to respond to
            KeyCode: "Enter",        // The plain text key name pressed
            KeyState: "KEY_PRESSED", // What happened
            Sender: "SERVER",        // Source of the input.
            Duration: 0.1234         // Duration of keypress (evdev only)
            SpecialKeys: [],         // Internal Module Processing (evdev only)
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

### <a name="RemoteSetup"></a>Setting Up The Remote
To setup the Fire Stick Remote with a Raspberry Pi Zero W or Raspberry Pi 3 (or any other device with bluetooth) ([source](http://openelec.tv/forum/104-bluetooth-remotes/75420-fire-tv-stick-remote-with-raspberry-pi)):

1. Put the remote into `Pairing` mode by holding the `Home` button for at least 10 seconds.
2. Pair the device to your MM like a standard bluetooth device.
3. Confirm the device is connected using `cat /proc/bus/input/devices`
    ```
    # cat /proc/bus/input/devices
    I: Bus=0005 Vendor=1949 Product=0404 Version=011b
    N: Name="Amazon Fire TV Remote"
    P: Phys=00:1a:7d:da:71:13
    S: Sysfs=/devices/platform/bcm2708_usb/usb1/1-1/1-1.3/1-1.3:1.0/bluetooth/hci0/hci0:71/0005:1949:0404.0001/input/input0
    U: Uniq=a0:02:dc:e0:f9:d7
    H: Handlers=kbd event0 
    B: PROP=0
    B: EV=10001b
    B: KEY=10000 1110 40000800 1681 0 0 0
    B: ABS=100 0
    B: MSC=10
    ```
    Note the "Handlers" line: your `evdev_path` will be `/dev/input/event0` in this case.
4. Test the device and get the key map by using `evtest` (may need to install using `sudo apt-get install evtest`):
    ```
    # evtest /dev/input/event0
    Input driver version is 1.0.1
    Input device ID: bus 0x5 vendor 0x1949 product 0x404 version 0x11b
    Input device name: "Amazon Fire TV Remote"
    Supported events:
      Event type 0 (EV_SYN)
      Event type 1 (EV_KEY)
        Event code 96 (KEY_KPENTER)
        Event code 103 (KEY_UP)
    ...
    ```

## <a name="WhyPython"></a>Why python-evdev?

This module uses a separate Python script that runs in the background on the server and monitors the input device file for events. This method is used to capture input from the remote because (a) not all buttons are passed to the browser as keyboard events and (b) some that do get passed to the browser can't have their default function overridden.  Initially, the plan was to just create a module to capture keystrokes in the browser via pure JS; however, only the directional pad of the remote was passed as keystrokes. In addition, not only would the "Home" button not appear as a key press, it would also re-direct to the browser's homepage.

The method used in this module uses `python-evdev`, a python module which hooks into `evdev`, a Linux system subprocess that can receive events from an input device, such as the remote (or standard keyboards and mice). 

The script in this module runs in the background and monitors for input events via the input device handler's event file. It then processes these events as key presses and sends them to the MagicMirror via an HTTP GET call to the "Notify Server".

The script has a normal mode, which waits for both a `KEY_DOWN` and a `KEY_UP` event and then sends a `KEY_PRESSED` notification to the Mirror. It will also monitor the duration of the key press and will send `KEY_LONGPRESSED` if the button was held for longer than the set threshold.  This is useful for performing different tasks based on short and long key presses.  `rawMode` can also be enabled to send the individual `KEY_DOWN`, `KEY_UP`, and `KEY_HOLD` events to the Mirror.

The script runs using PM2 to monitor and reload if necessary.

#### Python Script Options
All of the options below can be set using the module config except debug mode. This table provided for debugging purposes if you need to run the script stand-alone.

| Arguement         | Description
|-------------------|-----------------
|`-e EVENTPATH`, <br /> `--event EVENTPATH` | Path to the evdev event handler, e.g. /dev/input/event0
| `-n`, `--no-grab`     | By default, this script grabs all inputs from the device, which will block any commands from being passed natively. Use -n to disable
| `-r`, `--raw`         | Enables raw mode to send individual KEY_UP, KEY_DOWN, KEY_HOLD events instead of just KEY_PRESSED and KEY_LONGPRESSED.
| `-l TIME`, <br /> `--long-press-time TIME`  | Duration threshold between KEY_PRESSED and KEY_LONGPRESSED in seconds (as float). Default is 1.0s
| `-s SERVER`, <br /> `--server SERVER`   | Server URL to push events.
| `-d`, `--debug`    | Enables debugging mode which will print out any key events
| `-v`, `--verbose`  | Enables verbose debugging mode which will print out more info. Requires `-d`, `--debug` flag

## <a name="WhyNotify"></a>Why a Notify Server?

First, what is a "Notify" server?  This is simply an extra route added to the MagicMirror which takes in URL based notifications in the following form:
```
HTTP GET: http://localhost:8080/MMM-KeyBindings/notify?notification=##NOTIFICATION-TITLE##&payload=##JSON.STRINGIFY'D-PAYLOAD##
```

The purpose of the "Notify" server is two-fold: (1) it allows the python daemon to communicate easily with the MagicMirror and (2) if `enableRelayServer` is enabled in the config, it will accept URL notifcations and re-broadcast them internally to other modules.  This is useful for controlling other modules from an external source such as through an [ISY](https://www.universal-devices.com/residential/isy994i-series/) [Network Resources](https://wiki.universal-devices.com/index.php?title=ISY-994i_Series_INSTEON:Networking#Network_Resources).
