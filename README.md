# MMM-KeyBindings - Remote and Keyboard Control for MagicMirror²

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

The MMM-KeyBindings Module is a helper module that provides a method for controlling the MagicMirror² through a Bluetooth-connected Remote or through a keyboard by capturing button presses and keystrokes and either processing them or passing them on for use in other modules via notifications.

The primary features are:

1.  Control from Amazon Fire Stick remote control or other bluetooth device. See: [Why Fire Stick?](https://github.com/shbatm/MMM-KeyBindings/wiki/Background-Information#WhyFire) and [Why python-evdev?](https://github.com/shbatm/MMM-KeyBindings/wiki/Background-Information#WhyPython)
2.  Customizeable keyboard navigation and control.
    *  Basic navigation keys are captured, but this can be changed in the config.
3.  External control via HTTP GET calls.
    * Creates a HTTP "Notify" server to allow module notifications to be sent  from an external source. See: [Why a Notify Server?](https://github.com/shbatm/MMM-KeyBindings/wiki/Background-Information#WhyNotify)
4.  Context-based "Special Keys" can be used to perform various actions such as turing on/off the screen. See [Special Keys](#SpecialKeys).
6.  Key Presses are sent other modules for action via notifcation.
7.  Allows a module to "take focus", allowing other modules to ingore keypresses when a particular module has focus (e.g. in a pop-up menu).
8.  Allows for multiple instances of the MagicMirror to be open on different screens and be independently controlled.

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

You can then configure other modules to handle the key presses and, if necessary, request focus so only that module will respond to the keys (e.g. for a menu).  See [Handling Keys in Other Modules](https://github.com/shbatm/MMM-KeyBindings/wiki/Integration-into-Other-Modules)

## Installation

```shell
cd ~/MagicMirror/modules
git clone https://github.com/shbatm/MMM-KeyBindings
```

### Additional System Requirements

When using a bluetooth device, the following are required.  Not needed for keyboard-only input.

* Python v2.7.x
* `python-evdev` module:
    '''
    sudo apt-get install python-dev python-pip gcc
    sudo apt-get install linux-headers-$(uname -r)
    sudo pip install evdev
    '''
* PM2 node module: run `npm install pm2` inside MMM-KeyBindings folder
    - Note: if you already use PM2 to auto-launch MagicMirror, run the following to link the modules:
    '''
    cd ~/MagicMirror/modules/MMM-KeyBindings
    npm link pm2
    '''
### <a name="RemoteSetup"></a>Setting Up The Remote

See instructions [here](https://github.com/shbatm/MMM-KeyBindings/wiki/Remote-Setup)

## Configuration options 
#### (samples below)

| Option                | Description
|-----------------------|-----------
| `enabledKeyStates`    | Array of Key States that the module should handle.  <br />*Default:* `KEY_PRESSED` & `KEY_LONGPRESSED`<br />*Available:* `KEY_UP`, `KEY_DOWN`, `KEY_HOLD` (these require `evdev.rawMode: true` to receive events).
| `handleKeys`          | Array of additional keys to handle in this module above the standard set,  <br /> Reference [Mousetrap API](https://craig.is/killing/mice) for the available key enumerations.
| `disableKeys`         | Array of keys to ignore from the default set.
| `enableNotifyServer`  | Allow the use of the HTTP GET "Notify" server. Default is `true`, can be set to `false` to use local keyboard keys only.
| `endableRelayServer`  | Enables non-"KEYPRESS" HTTP GET notifications to be passed through to other modules when received on the "Notify" server. Useful for enabling 3rd party communication with other modules. <br />*Default:* `true` <br />*Requires:* `enableNotifyServer: true`.
| `evdev` | Configuration options for the `python-evdev` daemon. <br />See below for details.<br />*Example:*<br/>`evdev: { `<br />&nbsp;&nbsp;&nbsp;&nbsp;`enabled: true,`<br />&nbsp;&nbsp;&nbsp;&nbsp;`alias: 'Amazon Fire TV Remote'`<br />&nbsp;&nbsp;&nbsp;&nbsp;`bluetooth:'',`<br />&nbsp;&nbsp;&nbsp;&nbsp;`eventPath:'',`<br />&nbsp;&nbsp;&nbsp;&nbsp;`disableGrab: false,`<br />&nbsp;&nbsp;&nbsp;&nbsp;`longPressDuration: 0.7,`<br />&nbsp;&nbsp;&nbsp;&nbsp;`rawMode: false`<br />`}`
| &nbsp;&nbsp;&nbsp;&nbsp;`.alias` | Common Name / Alias of the Bluetooth Device to use.  This is what shows up in the Bluetooth menu of the GUI (e.g. '"Amazon Fire TV Remote"'). This enables bluetooth device dbus connect/disconnect monitoring to make the daemon more responsive.<br />*Note:* The `.bluetooth` and `.eventPath` details are not required if the Alias is used. <br />*Default:* `''` (disabled).
| &nbsp;&nbsp;&nbsp;&nbsp;`.bluetooth` | MAC Address of the Bluetooth Device to use - enables bluetooth device dbus connect/disconnect monitoring to make the daemon more responsive.<br /> *Default:* `''` (disabled).
| &nbsp;&nbsp;&nbsp;&nbsp;`.eventPath` | Path to the event input file<br /> *Default:* `/dev/input/event0`, `''` uses the default path.
| &nbsp;&nbsp;&nbsp;&nbsp;`.disableGrab` | By default, this script grabs all inputs from the device, which will block any commands from being passed natively. Set `disableGrab: true` to disable this behavior.
| &nbsp;&nbsp;&nbsp;&nbsp;`.longPressDuration` | The threshold in seconds (as float) between a `KEY_PRESSED` and `KEY_LONGPRESSED` event firing.
| &nbsp;&nbsp;&nbsp;&nbsp;`.rawMode` | Enables raw mode to send the individual `KEY_UP`, `KEY_DOWN`, `KEY_HOLD` events.
| `evdevKeymap`     | Map of the remote controls' key names (from `evtest`) to translate into standard keyboard event names. See Sample Key Map below.
| `specialKeys`     | List of Keys and KeyStates that map to special functions that will be handled by this module. See [Special Keys](#SpecialKeys) below.
| `extInterruptModes` | Array of "Modes" that can be set by assigning special keys. See [Special Keys](#SpecialKeys) below.

### Sample Configurations

#### Standard: Using FireStick Remote Locally and a Keyboard on Remote Browser

The config below uses the default [special keys](SpecialKeys) for the Fire Stick remote: short-pressing the 'Home' button will turn on the screen if it's off. Long-pressing 'Home' will turn off the screen if it's on.

```js
{
    module: 'MMM-KeyBindings',
    config: {
        evdev: {
            enabled: true,
            alias: "Amazon Fire TV Remote",
            bluetooth: '74:75:48:6E:C3:CB',
            eventPath: '',
            disableGrab: false, 
            longPressDuration: 0.7, 
            rawMode: false
        },
        enableNotifyServer: true,
        enableRelayServer: true,
        enableMousetrap: true,
    }
},
```

#### Basic: Use Keyboard Only with Default Keys
```js
{
    module: 'MMM-KeyBindings',
    config: {
        enableNotifyServer: false,
        enableMousetrap: true,
    }
},
```

### Remote Control Key Map

The following is the default key map for the Amazon Fire Stick remote. It maps keys to "Standard" keyboard key names for convenience. The incoming or outgoing names can be changed to suit your needs by adding a new copy of the keymap to the config.

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

**If you are not using a Fire Stick Remote:** You may need to adjust the key assignments above to match your remote. See [Remote Setup](https://github.com/shbatm/MMM-KeyBindings/wiki/Remote-Setup) for how to run `evtest` and display the key names for your remote/device.

**Note about changing key names:** If for example, you wanted "KEY_RIGHT" from the bluetooth remote to simulate a "k" being pressed on a keyboard:

1. Add the whole evdevKeymap above to your config section.
2. Change `ArrowRight: "KEY_RIGHT"` to `k: "KEY_RIGHT"`
3. If you want to also be able to use a keyboard when using a remote browser:
    * Make sure `enableMousetrap: true` is in your config and then add: `handleKeys: [ 'k' ]` to tell Mousetrap to bind to the "k" key. This is required because by default Mousetrap only binds to the same keys as those in the key map above.

### <a name="SpecialKeys"></a>Special Keys
Special Keys are keys which can be used to perform special functions within the module.  They are pre-processed before sending a notification.

They are processed in a queue in the order listed in the configuration. The same key can be assigned to multiple special keys for context-based situations -- for example, you can turn on the screen if it's off; if it's already on, the same key can be used to open a menu or do something else.  If the Special Key doesn't need to be processed (e.g. turning on a screen, but the screen is already on), then it will be passed along like a normal key press.

Below is the default, which can be modified by adding a modified version in your config.

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

## <a name="HandlingKeys"></a>Handling Keys in Another Module

To handle key press events in your module, see this [wiki page](https://github.com/shbatm/MMM-KeyBindings/wiki/Integration-into-Other-Modules) and refer to [handleKeys.js](https://github.com/shbatm/MMM-KeyBindings/blob/master/handleKeys.js) for drop-in functions with detailed documentation.

## Development Path
This module was created as a stepping stone to allow other modules to be tweaked to respond to keyboard presses--mainly for navigation purposes. Please add any requests via the Issues for this repo.

**Using this module?** View a list of all modules that support MMM-KeyBindings on the wiki [here](https://github.com/shbatm/MMM-KeyBindings/wiki/Supported-Modules).