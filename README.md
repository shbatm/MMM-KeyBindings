# MMM-KeyBindings - Remote and Keyboard Control for MagicMirror²

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

The MMM-KeyBindings Module is a helper module that provides a method for controlling the MagicMirror² through a Bluetooth-connected Remote or through a keyboard by capturing button presses and keystrokes and either processing them or passing them on for use in other modules via notifications.

The primary features are:

1.  Control from Amazon Fire Stick remote control or other bluetooth device. See: [Why Fire Stick?](https://github.com/shbatm/MMM-KeyBindings/wiki/Background-Information#WhyFire) 
2.  Customizeable keyboard navigation and control.
    *  Basic navigation keys are captured, but this can be changed in the config.
3.  Key Presses are sent other modules for action via notifcation.
4.  Assign keys to perform certain actions automatically (e.g. turn on/off the monitor when the HOME key is pressed, using MMM-Remote-Control).
5.  Allows a module to "take focus", allowing other modules to ingore keypresses when a particular module has focus (e.g. in a pop-up menu).
6.  Allows for multiple instances of the MagicMirror to be open on different screens and be independently controlled.

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
*NOTE:* If you are not planning to use this module with anything but a standard keyboard. STOP HERE. For advanced control using something like the Amazon Fire TV Remote, continue with the steps below:
1. Connect your device and make sure it's recognized (for example, using the Desktop bluetooth device menu). See instructions [here](https://github.com/shbatm/MMM-KeyBindings/wiki/Remote-Setup)
2. Find the "Name" of the device using one of the two methods below:
    1. From a terminal run `cat /proc/bus/input/devices | grep "Name"` to get the Name to use
    2. From a terminal run `udevadm info -a -p $(udevadm info -q path -n /dev/input/event0) | grep ATTRS{name}`, assuming this is the only device connected. You may have to change `event0` to something else.  Check `ls /dev/input/` to see which ones are currently connected.
3. Edit the `99-btremote.rules` file in this module's directory to use the name you found.
4. Run `cd ~/MagicMirror/modules/MMM-KeyBindings && npm install`.

## Configuration options 
#### (samples below)

| Option                | Description
|:---------------------:|-----------
| `enableKeyboard` | Whether or not to capture keys from a standard keyboard. <br>*Optional* Default: `false` - keyboard is not enabled. Set to `true` to enable a standard keyboard. Make sure no other modules are using the keyboard (e.g. MMM-OnScreenMenu).
| `enabledKeyStates`    | Array of Key States that the module should handle.  <br />*Default:* `KEY_PRESSED` & `KEY_LONGPRESSED`
| `handleKeys`          | Array of additional keys to handle in this module above the standard set,  <br /> Reference [Mousetrap API](https://craig.is/killing/mice) for the available key enumerations.
| `disableKeys`         | Array of keys to ignore from the default set.
| `evdev` | Configuration options for the `evdev` daemon. <br />See below for details.<br />*Example:*<br/>`evdev: { `<br />&nbsp;&nbsp;&nbsp;&nbsp;`enabled: true,`<br />&nbsp;&nbsp;&nbsp;&nbsp;`eventPath: '/dev/input/btremote',`<br />`}`
| &nbsp;&nbsp;&nbsp;&nbsp;`.eventPath` | Path to the event input file<br /> *Default:* `/dev/input/btremote`
| `keyMap`     | Map of the remote controls' key names (from `evtest`) to translate into standard keyboard event names. See Sample Key Map below.
| `actions` | Actions this module will take on certain key presses. See "Actions" section below.<br>*Default:* Ask [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control) to toggle the screen on and off when "Home" is long-pressed.<br>`actions: [{`<br>&nbsp;&nbsp;`key: "Home",`<br>&nbsp;&nbsp;`state: "KEY_LONGPRESSED",`<br>&nbsp;&nbsp;`instance: "SERVER",`<br>&nbsp;&nbsp;`mode: "DEFAULT",`<br>&nbsp;&nbsp;`notification: "REMOTE_ACTION",`<br>&nbsp;&nbsp;`payload: { action: "MONITORTOGGLE" }`<br>`}]`

### Sample Configurations

#### Standard: Using FireStick Remote Locally and a Keyboard on Remote Browser

The config below uses the default [special keys](SpecialKeys) for the Fire Stick remote: Long-pressing 'Home' will toggle the screen on/off.

```js
{
    module: 'MMM-KeyBindings',
    config: {
        enableKeyboard: true
    }
},
```

#### Basic: Use Keyboard Only with Default Keys (no remote)
```js
{
    module: 'MMM-KeyBindings',
    config: {
        evdev: { enabled: false },
        enableKeyboard: true,
    }
},
```

### Remote Control Key Map

The following is the default key map for the Amazon Fire Stick remote. It maps keys to "Standard" keyboard key names for convenience. The incoming or outgoing names can be changed to suit your needs by adding a new copy of the keymap to the config.

```
keyMap: {  
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
    * Make sure `enableKeyboard: true` is in your config and then add: `handleKeys: [ 'k' ]` to tell Mousetrap to bind to the "k" key. This is required because by default Mousetrap only binds to the same keys as those in the key map above.

## Actions

This module by default just receives key presses and sends them on for other modules' to handle. You can customize the actions this module will take on certain keys by providing an array of `action` objects in the config.

### Action Objects:

| Key | Description |
| :-: | --- |
| `key` | The `keyName` to respond to when pressed.
| `state` | The `keyState` to respond to when pressed.<br>*Optional:* Either "KEY_PRESSED" or "KEY_LONGPRESSED", or it can be omitted to respond to both.
| `instance` | The `instance` to respond to when pressed.<br>*Optional:* Either "SERVER" to respond only on the main Mirror's screen or "LOCAL" to respond in any remote web browser windows, or it can be omitted to respond on both.
| `mode` | The Current `keyPressMode` to respond to.<br>*Optional:* If you use modules that take over the key mode (like MMM-OnScreenMenu), you may only want the action to happen when it's in "DEFAULT" mode.
| `notification` | The notification to send when a matching key press is detected.
| `payload` | The payload to send with the notification.

### Examples:

The following is an example Actions configuration to:

1. Toggle the monitor on/off when the Bluetooth remote's Home button is long-pressed (requires MMM-Remote-Control to handle command)
2. Change the slides in [MMM-Carousel w/ Slide Navigation](https://github.com/shbatm/MMM-Carousel) when the left or right buttons are pushed.
3. Exit whatever mode you're in, back to DEFAULT when Return is long pressed.

```js
actions: [{
    key: "Home",
    state: "KEY_LONGPRESSED",
    instance: "SERVER",
    mode: "DEFAULT",
    notification: "REMOTE_ACTION",
    payload: { action: "MONITORTOGGLE" }
 },
 {
    key: "ArrowLeft",
    state: "KEY_LONGPRESSED",
    notification: "CAROUSEL_PREVIOUS"
 },
 {
    key: "ArrowRight",
    state: "KEY_LONGPRESSED",
    notification: "CAROUSEL_NEXT"
 },
 {
    key: "Return",
    state: "KEY_LONGPRESSED",
    changeMode: "DEFAULT"
 }
]
``` 

## Handling Keys in Another Module

To handle key press events in your module, see this [wiki page](https://github.com/shbatm/MMM-KeyBindings/wiki/Integration-into-Other-Modules)

## Development Path
This module was created as a stepping stone to allow other modules to be tweaked to respond to keyboard presses--mainly for navigation purposes. Please add any requests via the Issues for this repo.

**Using this module?** View a list of all modules that support MMM-KeyBindings on the wiki [here](https://github.com/shbatm/MMM-KeyBindings/wiki/Supported-Modules).

## Known Issues

* The following only work with `evdev` / remote control on the main screen. When using `Mousetrap` for keyboard events, these pass like regular key presses or flat-out don't work:
    * `KEY_LONGPRESS`